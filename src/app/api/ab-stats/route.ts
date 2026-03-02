import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext } from '@/lib/apiAuth';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const performances = await db.tonePerformance.findMany({
    where: { userId: ctx.userId },
    orderBy: { avgEngagementScore: 'desc' },
  });

  // Group by platform
  const byPlatform: Record<string, Array<{
    tone: string;
    totalPosts: number;
    totalLikes: number;
    totalReplies: number;
    avgEngagementScore: number;
  }>> = {};

  for (const p of performances) {
    if (!byPlatform[p.platform]) byPlatform[p.platform] = [];
    byPlatform[p.platform].push({
      tone: p.tone,
      totalPosts: p.totalPosts,
      totalLikes: p.totalLikes,
      totalReplies: p.totalReplies,
      avgEngagementScore: p.avgEngagementScore,
    });
  }

  return NextResponse.json({ byPlatform, all: performances });
}
