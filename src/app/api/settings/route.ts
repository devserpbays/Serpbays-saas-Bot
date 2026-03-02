import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext, requireRole } from '@/lib/apiAuth';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await db.settings.findUnique({ where: { workspaceId: ctx.workspaceId } });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json();

  const {
    companyName, companyDescription, keywords, platforms, subreddits, promptTemplate,
    socialAccounts, facebookGroups,
    facebookKeywords, facebookDailyLimit, facebookAutoPostThreshold,
    twitterKeywords, twitterDailyLimit, twitterAutoPostThreshold,
    redditKeywords, redditDailyLimit, redditAutoPostThreshold,
    quoraKeywords, quoraDailyLimit, quoraAutoPostThreshold,
    youtubeKeywords, youtubeDailyLimit, youtubeAutoPostThreshold,
    pinterestKeywords, pinterestDailyLimit, pinterestAutoPostThreshold,
    competitors, competitorAlertThreshold,
    abTestingEnabled, abVariationCount, abTonePresets, abAutoOptimize,
  } = body;

  const updateData: Record<string, unknown> = {};
  if (companyName !== undefined) updateData.companyName = companyName;
  if (companyDescription !== undefined) updateData.companyDescription = companyDescription;
  if (keywords !== undefined) updateData.keywords = keywords;
  if (platforms !== undefined) updateData.platforms = platforms;
  if (subreddits !== undefined) updateData.subreddits = subreddits;
  if (promptTemplate !== undefined) updateData.promptTemplate = promptTemplate;
  if (socialAccounts !== undefined) updateData.socialAccounts = socialAccounts;
  if (facebookGroups !== undefined) updateData.facebookGroups = facebookGroups;
  if (facebookKeywords !== undefined) updateData.facebookKeywords = facebookKeywords;
  if (facebookDailyLimit !== undefined) updateData.facebookDailyLimit = facebookDailyLimit;
  if (facebookAutoPostThreshold !== undefined) updateData.facebookAutoPostThreshold = facebookAutoPostThreshold;
  if (twitterKeywords !== undefined) updateData.twitterKeywords = twitterKeywords;
  if (twitterDailyLimit !== undefined) updateData.twitterDailyLimit = twitterDailyLimit;
  if (twitterAutoPostThreshold !== undefined) updateData.twitterAutoPostThreshold = twitterAutoPostThreshold;
  if (redditKeywords !== undefined) updateData.redditKeywords = redditKeywords;
  if (redditDailyLimit !== undefined) updateData.redditDailyLimit = redditDailyLimit;
  if (redditAutoPostThreshold !== undefined) updateData.redditAutoPostThreshold = redditAutoPostThreshold;
  if (quoraKeywords !== undefined) updateData.quoraKeywords = quoraKeywords;
  if (quoraDailyLimit !== undefined) updateData.quoraDailyLimit = quoraDailyLimit;
  if (quoraAutoPostThreshold !== undefined) updateData.quoraAutoPostThreshold = quoraAutoPostThreshold;
  if (youtubeKeywords !== undefined) updateData.youtubeKeywords = youtubeKeywords;
  if (youtubeDailyLimit !== undefined) updateData.youtubeDailyLimit = youtubeDailyLimit;
  if (youtubeAutoPostThreshold !== undefined) updateData.youtubeAutoPostThreshold = youtubeAutoPostThreshold;
  if (pinterestKeywords !== undefined) updateData.pinterestKeywords = pinterestKeywords;
  if (pinterestDailyLimit !== undefined) updateData.pinterestDailyLimit = pinterestDailyLimit;
  if (pinterestAutoPostThreshold !== undefined) updateData.pinterestAutoPostThreshold = pinterestAutoPostThreshold;
  if (competitors !== undefined) updateData.competitors = competitors;
  if (competitorAlertThreshold !== undefined) updateData.competitorAlertThreshold = competitorAlertThreshold;
  if (abTestingEnabled !== undefined) updateData.abTestingEnabled = abTestingEnabled;
  if (abVariationCount !== undefined) updateData.abVariationCount = abVariationCount;
  if (abTonePresets !== undefined) updateData.abTonePresets = abTonePresets;
  if (abAutoOptimize !== undefined) updateData.abAutoOptimize = abAutoOptimize;

  const settings = await db.settings.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      companyName: companyName || 'My Company',
      companyDescription: companyDescription || '',
      keywords: keywords || [],
      platforms: platforms || ['twitter', 'reddit'],
      subreddits: subreddits || [],
      promptTemplate: promptTemplate || '',
      socialAccounts: socialAccounts || [],
      facebookGroups: facebookGroups || [],
      facebookKeywords: facebookKeywords || [],
      facebookDailyLimit: facebookDailyLimit ?? 5,
      facebookAutoPostThreshold: facebookAutoPostThreshold ?? 70,
      twitterKeywords: twitterKeywords || [],
      twitterDailyLimit: twitterDailyLimit ?? 10,
      twitterAutoPostThreshold: twitterAutoPostThreshold ?? 70,
      redditKeywords: redditKeywords || [],
      redditDailyLimit: redditDailyLimit ?? 5,
      redditAutoPostThreshold: redditAutoPostThreshold ?? 70,
      quoraKeywords: quoraKeywords || [],
      quoraDailyLimit: quoraDailyLimit ?? 3,
      quoraAutoPostThreshold: quoraAutoPostThreshold ?? 70,
      youtubeKeywords: youtubeKeywords || [],
      youtubeDailyLimit: youtubeDailyLimit ?? 5,
      youtubeAutoPostThreshold: youtubeAutoPostThreshold ?? 70,
      pinterestKeywords: pinterestKeywords || [],
      pinterestDailyLimit: pinterestDailyLimit ?? 5,
      pinterestAutoPostThreshold: pinterestAutoPostThreshold ?? 70,
      competitors: competitors || [],
      competitorAlertThreshold: competitorAlertThreshold ?? 60,
      abTestingEnabled: abTestingEnabled ?? true,
      abVariationCount: abVariationCount ?? 3,
      abTonePresets: abTonePresets || ['helpful', 'professional', 'witty'],
      abAutoOptimize: abAutoOptimize ?? false,
    },
    update: updateData,
  });

  // Log activity
  await db.activityLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: 'settings.updated',
      targetType: 'settings',
      targetId: settings.id,
    },
  });

  return NextResponse.json({ settings });
}
