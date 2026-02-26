import { NextResponse } from 'next/server';
import { getApiContext, requireRole } from '@/lib/apiAuth';
import { runScrape } from '@/lib/scraper';

export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const result = await runScrape(ctx.workspaceId);
  return NextResponse.json(result);
}
