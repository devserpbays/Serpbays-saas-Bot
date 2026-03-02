import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext } from '@/lib/apiAuth';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const statuses = ['new', 'evaluating', 'evaluated', 'approved', 'rejected', 'posted'] as const;

  const [total, ...counts] = await Promise.all([
    db.post.count({ where: { workspaceId: ctx.workspaceId } }),
    ...statuses.map(s => db.post.count({ where: { workspaceId: ctx.workspaceId, status: s } })),
  ]);

  const byStatus: Record<string, number> = {};
  statuses.forEach((s, i) => { byStatus[s] = counts[i]; });

  const platforms = ['facebook', 'twitter', 'reddit', 'quora', 'youtube', 'pinterest'] as const;
  const platformCounts = await Promise.all([
    ...platforms.map(p => db.post.count({ where: { workspaceId: ctx.workspaceId, platform: p } })),
    ...platforms.map(p => db.post.count({ where: { workspaceId: ctx.workspaceId, platform: p, status: 'posted' } })),
  ]);

  const byPlatform: Record<string, number> = {};
  const postedByPlatform: Record<string, number> = {};
  platforms.forEach((p, i) => {
    byPlatform[p] = platformCounts[i];
    postedByPlatform[p] = platformCounts[platforms.length + i];
  });

  // Auto counts
  const [autoApprovedCount, autoPostedCount] = await Promise.all([
    db.post.count({ where: { workspaceId: ctx.workspaceId, autoApproved: true } }),
    db.post.count({ where: { workspaceId: ctx.workspaceId, autoPosted: true } }),
  ]);

  // Competitor opportunities count
  const competitorOpportunities = await db.post.count({
    where: {
      workspaceId: ctx.workspaceId,
      isCompetitorOpportunity: true,
      status: { notIn: ['approved', 'posted'] },
    },
  });

  // Tone performance
  const tonePerformance = await db.tonePerformance.findMany({
    where: { userId: ctx.userId },
    orderBy: { avgEngagementScore: 'desc' },
  });

  return NextResponse.json({
    total,
    byStatus,
    byPlatform,
    postedByPlatform,
    autoApproved: autoApprovedCount,
    autoPosted: autoPostedCount,
    competitorOpportunities,
    tonePerformance,
  });
}
