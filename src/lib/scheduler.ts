import { connectDB } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { runScrape } from '@/lib/scraper';
import { runEvaluation } from '@/lib/ai';
import { runAutoPost } from '@/lib/autoPost';
import type { PipelineResult, PlatformSchedule, SchedulerStatus } from '@/lib/types';

interface SchedulerEntry {
  workspaceId: string;
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
  lastRunAt: Date | null;
  lastResult: PipelineResult | null;
  nextRunAt: Date | null;
  running: boolean;
  error: string | null;
}

// Module-level state — persists across requests in the same server process
const schedulers = new Map<string, SchedulerEntry>();

const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes minimum
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes default

/**
 * Parse a simple cron interval string into milliseconds.
 * Supports: "* /N * * * *" (every N minutes) pattern.
 * Falls back to DEFAULT_INTERVAL_MS for complex expressions.
 */
function parseCronToMs(cron: string): number {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return DEFAULT_INTERVAL_MS;

  const minutePart = parts[0];
  // Match */N pattern (every N minutes)
  const match = minutePart.match(/^\*\/(\d+)$/);
  if (match) {
    const minutes = parseInt(match[1], 10);
    return Math.max(minutes * 60 * 1000, MIN_INTERVAL_MS);
  }

  return DEFAULT_INTERVAL_MS;
}

/**
 * Check if current time falls within any platform's active schedule window.
 */
function isWithinScheduleWindow(schedules: Record<string, PlatformSchedule>): boolean {
  const entries = Object.values(schedules);
  if (entries.length === 0) return true; // No schedules = always active

  for (const schedule of entries) {
    const now = new Date();

    // Convert to the schedule's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timezone || 'UTC',
      hour: 'numeric',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const weekdayStr = parts.find(p => p.type === 'weekday')?.value || '';

    // Map weekday string to number (0=Sun ... 6=Sat)
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayNum = dayMap[weekdayStr] ?? new Date().getDay();

    // Check day-of-week (empty = all days)
    if (schedule.days && schedule.days.length > 0 && !schedule.days.includes(dayNum)) {
      continue;
    }

    // Check hour window
    const start = schedule.startHour ?? 0;
    const end = schedule.endHour ?? 24;
    if (hour >= start && hour < end) {
      return true;
    }
  }

  return false;
}

/**
 * Compute the shortest cron interval across all platform schedules.
 */
function resolveIntervalMs(schedules: Record<string, PlatformSchedule>): number {
  const entries = Object.values(schedules);
  if (entries.length === 0) return DEFAULT_INTERVAL_MS;

  let shortest = Infinity;
  for (const s of entries) {
    if (s.cronInterval) {
      shortest = Math.min(shortest, parseCronToMs(s.cronInterval));
    }
  }

  return shortest === Infinity ? DEFAULT_INTERVAL_MS : shortest;
}

/**
 * Execute one pipeline cycle for a workspace.
 */
async function executePipeline(entry: SchedulerEntry): Promise<void> {
  if (entry.running) return; // Prevent overlapping runs

  entry.running = true;
  entry.error = null;
  const startedAt = new Date();

  try {
    await connectDB();

    // Re-read schedules to check if still within window
    const settings = await Settings.findOne({ workspaceId: entry.workspaceId }).lean();
    if (!settings) {
      entry.error = 'Settings not found';
      entry.running = false;
      return;
    }

    const schedules = (settings as Record<string, unknown>).platformSchedules as Record<string, PlatformSchedule> | undefined;
    if (schedules && !isWithinScheduleWindow(schedules)) {
      // Outside schedule window — skip this cycle silently
      entry.running = false;
      entry.nextRunAt = new Date(Date.now() + entry.intervalMs);
      return;
    }

    // Phase 1: Scrape
    const scrapeResult = await runScrape(entry.workspaceId);
    // Phase 2: Evaluate (+ auto-approve)
    const evalResult = await runEvaluation(entry.workspaceId);
    // Phase 3: Auto-post approved posts
    const autoPostResult = await runAutoPost(entry.workspaceId);

    const finishedAt = new Date();
    entry.lastResult = {
      scraped: scrapeResult.totalScraped,
      newPosts: scrapeResult.newPosts,
      evaluated: evalResult.evaluated,
      autoApproved: evalResult.autoApproved,
      autoPosted: autoPostResult.posted,
      skipped: evalResult.total - evalResult.evaluated,
      errors: [...scrapeResult.errors, ...autoPostResult.errors],
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
    entry.lastRunAt = finishedAt;
    entry.nextRunAt = new Date(finishedAt.getTime() + entry.intervalMs);
  } catch (err) {
    entry.error = (err as Error).message || 'Pipeline execution failed';
    entry.nextRunAt = new Date(Date.now() + entry.intervalMs);
  } finally {
    entry.running = false;
  }
}

/**
 * Start the scheduler for a workspace.
 */
export async function startScheduler(workspaceId: string): Promise<SchedulerStatus> {
  // Stop existing scheduler if any
  stopScheduler(workspaceId);

  await connectDB();
  const settings = await Settings.findOne({ workspaceId }).lean();
  if (!settings) {
    throw new Error('Settings not found for workspace');
  }

  const schedules = (settings as Record<string, unknown>).platformSchedules as Record<string, PlatformSchedule> | undefined || {};
  const intervalMs = resolveIntervalMs(schedules);

  const entry: SchedulerEntry = {
    workspaceId,
    intervalMs,
    timer: null,
    lastRunAt: null,
    lastResult: null,
    nextRunAt: new Date(Date.now() + intervalMs),
    running: false,
    error: null,
  };

  // Set up the repeating interval
  entry.timer = setInterval(() => {
    executePipeline(entry);
  }, intervalMs);

  // Run immediately on start
  executePipeline(entry);

  schedulers.set(workspaceId, entry);

  return getStatus(workspaceId);
}

/**
 * Stop the scheduler for a workspace.
 */
export function stopScheduler(workspaceId: string): void {
  const entry = schedulers.get(workspaceId);
  if (entry) {
    if (entry.timer) clearInterval(entry.timer);
    schedulers.delete(workspaceId);
  }
}

/**
 * Get scheduler status for a workspace.
 */
export function getStatus(workspaceId: string): SchedulerStatus {
  const entry = schedulers.get(workspaceId);
  if (!entry) {
    return {
      workspaceId,
      running: false,
      intervalMs: 0,
      lastRunAt: null,
      lastResult: null,
      nextRunAt: null,
      error: null,
    };
  }

  return {
    workspaceId,
    running: true,
    intervalMs: entry.intervalMs,
    lastRunAt: entry.lastRunAt?.toISOString() || null,
    lastResult: entry.lastResult,
    nextRunAt: entry.nextRunAt?.toISOString() || null,
    error: entry.error,
  };
}

/**
 * Check if scheduler is active for a workspace.
 */
export function isRunning(workspaceId: string): boolean {
  return schedulers.has(workspaceId);
}
