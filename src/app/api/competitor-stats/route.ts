import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Post from '@/models/Post';
import { getApiContext } from '@/lib/apiAuth';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  // Aggregate competitor mentions
  const pipeline = [
    {
      $match: {
        workspaceId: ctx.workspaceId,
        competitorMentioned: { $ne: '' },
      },
    },
    {
      $group: {
        _id: '$competitorMentioned',
        totalMentions: { $sum: 1 },
        positiveSentiment: {
          $sum: { $cond: [{ $eq: ['$competitorSentiment', 'positive'] }, 1, 0] },
        },
        negativeSentiment: {
          $sum: { $cond: [{ $eq: ['$competitorSentiment', 'negative'] }, 1, 0] },
        },
        neutralSentiment: {
          $sum: { $cond: [{ $eq: ['$competitorSentiment', 'neutral'] }, 1, 0] },
        },
        opportunities: {
          $sum: { $cond: ['$isCompetitorOpportunity', 1, 0] },
        },
        avgOpportunityScore: { $avg: '$competitorOpportunityScore' },
      },
    },
    { $sort: { totalMentions: -1 as const } },
  ];

  const competitorStats = await Post.aggregate(pipeline);

  // 7-day trend
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const trendPipeline = [
    {
      $match: {
        workspaceId: ctx.workspaceId,
        competitorMentioned: { $ne: '' },
        scrapedAt: { $gte: sevenDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          competitor: '$competitorMentioned',
          day: { $dateToString: { format: '%Y-%m-%d', date: '$scrapedAt' } },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.day': 1 as const } },
  ];

  const trendData = await Post.aggregate(trendPipeline);

  // Total opportunities count
  const opportunityCount = await Post.countDocuments({
    workspaceId: ctx.workspaceId,
    isCompetitorOpportunity: true,
    status: { $nin: ['approved', 'posted'] },
  });

  return NextResponse.json({
    competitors: competitorStats,
    trend: trendData,
    totalOpportunities: opportunityCount,
  });
}
