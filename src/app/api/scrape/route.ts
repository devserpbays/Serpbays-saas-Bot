import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/apiAuth';
import { runScrape } from '@/lib/scraper';

export async function POST() {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await runScrape(userId);
  return NextResponse.json(result);
}
