import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/apiAuth';
import { runScrape } from '@/lib/scraper';
import { runEvaluation } from '@/lib/ai';

export async function POST() {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const startedAt = new Date().toISOString();

  // Phase 1: Scrape
  const scrapeResult = await runScrape(userId);

  // Phase 2: Evaluate
  const evalResult = await runEvaluation(userId);

  const finishedAt = new Date().toISOString();

  return NextResponse.json({
    scraped: scrapeResult.totalScraped,
    newPosts: scrapeResult.newPosts,
    evaluated: evalResult.evaluated,
    skipped: evalResult.total - evalResult.evaluated,
    errors: scrapeResult.errors,
    startedAt,
    finishedAt,
  });
}
