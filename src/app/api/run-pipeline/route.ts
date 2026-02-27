import { NextResponse } from 'next/server';
import { getApiContext, requireRole } from '@/lib/apiAuth';
import { runScrape } from '@/lib/scraper';
import { runEvaluation } from '@/lib/ai';
import { runAutoPost } from '@/lib/autoPost';

export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const startedAt = new Date().toISOString();

  // Phase 1: Scrape
  const scrapeResult = await runScrape(ctx.workspaceId);

  // Phase 2: Evaluate (+ auto-approve)
  const evalResult = await runEvaluation(ctx.workspaceId);

  // Phase 3: Auto-post approved posts
  const autoPostResult = await runAutoPost(ctx.workspaceId);

  const finishedAt = new Date().toISOString();

  return NextResponse.json({
    scraped: scrapeResult.totalScraped,
    newPosts: scrapeResult.newPosts,
    evaluated: evalResult.evaluated,
    autoApproved: evalResult.autoApproved,
    autoPosted: autoPostResult.posted,
    skipped: evalResult.total - evalResult.evaluated,
    errors: [...scrapeResult.errors, ...autoPostResult.errors],
    startedAt,
    finishedAt,
  });
}
