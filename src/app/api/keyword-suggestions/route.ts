import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext, requireRole } from '@/lib/apiAuth';
import { suggestKeywords } from '@/lib/ai';
import type { Competitor } from '@/lib/types';

export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const settings = await db.settings.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!settings) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }

  const suggestions = await suggestKeywords(
    settings.companyName,
    settings.companyDescription,
    (settings.keywords as unknown as string[]) || [],
    (settings.competitors as unknown as Competitor[]) || undefined
  );

  // Save suggested keywords
  await db.settings.update({
    where: { workspaceId: ctx.workspaceId },
    data: {
      suggestedKeywords: suggestions.map(s => s.keyword),
      keywordSuggestionsLastRun: new Date(),
    },
  });

  return NextResponse.json({ suggestions });
}
