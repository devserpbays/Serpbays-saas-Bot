import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get('days') || '14');

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  sinceDate.setHours(0, 0, 0, 0);

  const metrics = await db.keywordMetric.findMany({
    where: {
      userId: ctx.userId,
      date: { gte: sinceDate },
    },
    orderBy: { date: 'desc' },
  });

  // Aggregate by keyword
  const keywordMap: Record<string, {
    keyword: string;
    totalPosts: number;
    totalHighRelevance: number;
    avgScore: number;
    scoreSum: number;
    days: number;
    dailyData: Array<{ date: string; postsFound: number; avgScore: number }>;
  }> = {};

  for (const m of metrics) {
    const kw = m.keyword;
    if (!keywordMap[kw]) {
      keywordMap[kw] = {
        keyword: kw,
        totalPosts: 0,
        totalHighRelevance: 0,
        avgScore: 0,
        scoreSum: 0,
        days: 0,
        dailyData: [],
      };
    }
    keywordMap[kw].totalPosts += m.postsFound;
    keywordMap[kw].totalHighRelevance += m.highRelevanceCount;
    keywordMap[kw].scoreSum += m.avgRelevanceScore * m.postsFound;
    keywordMap[kw].days++;
    keywordMap[kw].dailyData.push({
      date: m.date.toISOString().split('T')[0],
      postsFound: m.postsFound,
      avgScore: m.avgRelevanceScore,
    });
  }

  // Calculate trends
  const keywords = Object.values(keywordMap).map(k => {
    k.avgScore = k.totalPosts > 0 ? k.scoreSum / k.totalPosts : 0;

    // Trend calculation: compare first half vs second half
    const midpoint = Math.floor(k.dailyData.length / 2);
    const firstHalf = k.dailyData.slice(midpoint);
    const secondHalf = k.dailyData.slice(0, midpoint);

    const firstAvg = firstHalf.reduce((s, d) => s + d.postsFound, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((s, d) => s + d.postsFound, 0) / (secondHalf.length || 1);

    let trend: 'rising' | 'falling' | 'stable' = 'stable';
    let trendPercent = 0;

    if (firstAvg > 0) {
      trendPercent = ((secondAvg - firstAvg) / firstAvg) * 100;
      if (trendPercent > 20) trend = 'rising';
      else if (trendPercent < -20) trend = 'falling';
    }

    return {
      keyword: k.keyword,
      totalPosts: k.totalPosts,
      totalHighRelevance: k.totalHighRelevance,
      avgScore: Math.round(k.avgScore * 10) / 10,
      trend,
      trendPercent: Math.round(trendPercent),
      dailyData: k.dailyData,
    };
  });

  keywords.sort((a, b) => b.totalPosts - a.totalPosts);

  return NextResponse.json({ keywords, days });
}
