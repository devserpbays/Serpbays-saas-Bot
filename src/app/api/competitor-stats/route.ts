import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext } from '@/lib/apiAuth';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Aggregate competitor mentions using groupBy
  const competitorGroups = await db.post.groupBy({
    by: ['competitorMentioned'],
    where: {
      workspaceId: ctx.workspaceId,
      competitorMentioned: { not: '' },
    },
    _count: { id: true },
    _avg: { competitorOpportunityScore: true },
    orderBy: { _count: { id: 'desc' } },
  });

  // Get sentiment breakdown per competitor
  const competitorStats = await Promise.all(
    competitorGroups.map(async (group) => {
      const [positive, negative, neutral, opportunities] = await Promise.all([
        db.post.count({ where: { workspaceId: ctx.workspaceId, competitorMentioned: group.competitorMentioned, competitorSentiment: 'positive' } }),
        db.post.count({ where: { workspaceId: ctx.workspaceId, competitorMentioned: group.competitorMentioned, competitorSentiment: 'negative' } }),
        db.post.count({ where: { workspaceId: ctx.workspaceId, competitorMentioned: group.competitorMentioned, competitorSentiment: 'neutral' } }),
        db.post.count({ where: { workspaceId: ctx.workspaceId, competitorMentioned: group.competitorMentioned, isCompetitorOpportunity: true } }),
      ]);
      return {
        _id: group.competitorMentioned,
        totalMentions: group._count.id,
        positiveSentiment: positive,
        negativeSentiment: negative,
        neutralSentiment: neutral,
        opportunities,
        avgOpportunityScore: group._avg.competitorOpportunityScore ?? 0,
      };
    })
  );

  // 7-day trend — raw posts grouped by date
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const trendPosts = await db.post.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      competitorMentioned: { not: '' },
      scrapedAt: { gte: sevenDaysAgo },
    },
    select: { competitorMentioned: true, scrapedAt: true },
  });

  // Aggregate trend client-side
  const trendMap: Record<string, Record<string, number>> = {};
  for (const p of trendPosts) {
    const day = p.scrapedAt.toISOString().split('T')[0];
    if (!trendMap[p.competitorMentioned]) trendMap[p.competitorMentioned] = {};
    trendMap[p.competitorMentioned][day] = (trendMap[p.competitorMentioned][day] || 0) + 1;
  }
  const trendData = Object.entries(trendMap).flatMap(([competitor, days]) =>
    Object.entries(days).map(([day, count]) => ({
      _id: { competitor, day },
      count,
    }))
  ).sort((a, b) => a._id.day.localeCompare(b._id.day));

  // Total opportunities count
  const totalOpportunities = await db.post.count({
    where: {
      workspaceId: ctx.workspaceId,
      isCompetitorOpportunity: true,
      status: { notIn: ['approved', 'posted'] },
    },
  });

  return NextResponse.json({
    competitors: competitorStats,
    trend: trendData,
    totalOpportunities,
  });
}
