import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Post from '@/models/Post';
import TonePerformance from '@/models/TonePerformance';
import { getApiContext } from '@/lib/apiAuth';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const statuses = ['new', 'evaluating', 'evaluated', 'approved', 'rejected', 'posted'] as const;

  const [total, ...counts] = await Promise.all([
    Post.countDocuments({ workspaceId: ctx.workspaceId }),
    ...statuses.map(s => Post.countDocuments({ workspaceId: ctx.workspaceId, status: s })),
  ]);

  const byStatus: Record<string, number> = {};
  statuses.forEach((s, i) => { byStatus[s] = counts[i]; });

  const platforms = ['facebook', 'twitter', 'reddit', 'quora', 'youtube', 'pinterest'] as const;
  const platformCounts = await Promise.all([
    ...platforms.map(p => Post.countDocuments({ workspaceId: ctx.workspaceId, platform: p })),
    ...platforms.map(p => Post.countDocuments({ workspaceId: ctx.workspaceId, platform: p, status: 'posted' })),
  ]);

  const byPlatform: Record<string, number> = {};
  const postedByPlatform: Record<string, number> = {};
  platforms.forEach((p, i) => {
    byPlatform[p] = platformCounts[i];
    postedByPlatform[p] = platformCounts[platforms.length + i];
  });

  // Auto counts
  const [autoApprovedCount, autoPostedCount] = await Promise.all([
    Post.countDocuments({ workspaceId: ctx.workspaceId, autoApproved: true }),
    Post.countDocuments({ workspaceId: ctx.workspaceId, autoPosted: true }),
  ]);

  // Competitor opportunities count
  const competitorOpportunities = await Post.countDocuments({
    workspaceId: ctx.workspaceId,
    isCompetitorOpportunity: true,
    status: { $nin: ['approved', 'posted'] },
  });

  // Tone performance
  const tonePerformance = await TonePerformance.find({ userId: ctx.userId })
    .sort({ avgEngagementScore: -1 })
    .lean();

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
