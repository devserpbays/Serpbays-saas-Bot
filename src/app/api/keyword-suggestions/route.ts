import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { getApiContext, requireRole } from '@/lib/apiAuth';
import { suggestKeywords } from '@/lib/ai';
import type { Competitor } from '@/lib/types';

export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  await connectDB();

  const settings = await Settings.findOne({ workspaceId: ctx.workspaceId });
  if (!settings) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }

  const suggestions = await suggestKeywords(
    settings.companyName,
    settings.companyDescription,
    settings.keywords || [],
    (settings.competitors as Competitor[]) || undefined
  );

  // Save suggested keywords
  settings.suggestedKeywords = suggestions.map(s => s.keyword);
  settings.keywordSuggestionsLastRun = new Date();
  await settings.save();

  return NextResponse.json({ suggestions });
}
