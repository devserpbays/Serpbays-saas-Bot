import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import TonePerformance from '@/models/TonePerformance';
import { getApiContext } from '@/lib/apiAuth';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const performances = await TonePerformance.find({ userId: ctx.userId })
    .sort({ avgEngagementScore: -1 })
    .lean();

  // Group by platform
  const byPlatform: Record<string, Array<{
    tone: string;
    totalPosts: number;
    totalLikes: number;
    totalReplies: number;
    avgEngagementScore: number;
  }>> = {};

  for (const p of performances) {
    const platform = p.platform as string;
    if (!byPlatform[platform]) byPlatform[platform] = [];
    byPlatform[platform].push({
      tone: p.tone as string,
      totalPosts: p.totalPosts as number,
      totalLikes: p.totalLikes as number,
      totalReplies: p.totalReplies as number,
      avgEngagementScore: p.avgEngagementScore as number,
    });
  }

  return NextResponse.json({ byPlatform, all: performances });
}
