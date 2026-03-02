import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext } from '@/lib/apiAuth';

export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Find posted replies with tone info
  const postedPosts = await db.post.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      status: 'posted',
      postedTone: { not: '' },
    },
  });

  if (!postedPosts.length) {
    return NextResponse.json({ updated: 0 });
  }

  // Aggregate by platform + tone
  const aggregation: Record<string, {
    totalPosts: number;
    totalLikes: number;
    totalReplies: number;
  }> = {};

  for (const post of postedPosts) {
    const key = `${post.platform}:${post.postedTone}`;
    if (!aggregation[key]) {
      aggregation[key] = { totalPosts: 0, totalLikes: 0, totalReplies: 0 };
    }
    aggregation[key].totalPosts++;
    const engagement = post.botReplyEngagement as { likes?: number; replies?: number } | undefined;
    aggregation[key].totalLikes += engagement?.likes || 0;
    aggregation[key].totalReplies += engagement?.replies || 0;
  }

  // Upsert tone performance records
  const ops = Object.entries(aggregation).map(([key, data]) => {
    const [platform, tone] = key.split(':');
    const avgEngagementScore = (data.totalLikes + data.totalReplies * 2) / data.totalPosts;

    return db.tonePerformance.upsert({
      where: { userId_platform_tone: { userId: ctx.userId, platform, tone } },
      create: {
        userId: ctx.userId,
        platform,
        tone,
        totalPosts: data.totalPosts,
        totalLikes: data.totalLikes,
        totalReplies: data.totalReplies,
        avgEngagementScore,
        lastUpdated: new Date(),
      },
      update: {
        totalPosts: data.totalPosts,
        totalLikes: data.totalLikes,
        totalReplies: data.totalReplies,
        avgEngagementScore,
        lastUpdated: new Date(),
      },
    });
  });

  if (ops.length > 0) {
    await db.$transaction(ops);
  }

  return NextResponse.json({ updated: ops.length });
}
