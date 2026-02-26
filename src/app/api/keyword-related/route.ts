import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { getApiContext } from '@/lib/apiAuth';
import { suggestRelatedKeywords } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { keyword } = await req.json();
  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
  }

  await connectDB();

  const settings = await Settings.findOne({ workspaceId: ctx.workspaceId }).lean();
  if (!settings) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }

  const suggestions = await suggestRelatedKeywords(
    keyword,
    (settings as { companyDescription: string }).companyDescription
  );

  return NextResponse.json({ suggestions });
}
