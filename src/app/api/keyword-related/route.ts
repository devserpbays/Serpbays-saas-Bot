import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext } from '@/lib/apiAuth';
import { suggestRelatedKeywords } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { keyword } = await req.json();
  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
  }

  const settings = await db.settings.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!settings) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }

  const suggestions = await suggestRelatedKeywords(keyword, settings.companyDescription);

  return NextResponse.json({ suggestions });
}
