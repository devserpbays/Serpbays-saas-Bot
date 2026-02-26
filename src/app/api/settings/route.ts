import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import ActivityLog from '@/models/ActivityLog';
import { getApiContext, requireRole } from '@/lib/apiAuth';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const settings = await Settings.findOne({ workspaceId: ctx.workspaceId }).lean();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  await connectDB();
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

  let settings = await Settings.findOne({ workspaceId: ctx.workspaceId });

  if (settings) {
    settings.companyName = companyName ?? settings.companyName;
    settings.companyDescription = companyDescription ?? settings.companyDescription;
    settings.keywords = keywords ?? settings.keywords;
    settings.platforms = platforms ?? settings.platforms;
    settings.subreddits = subreddits ?? settings.subreddits;
    settings.promptTemplate = promptTemplate ?? settings.promptTemplate;
    if (socialAccounts !== undefined) settings.socialAccounts = socialAccounts;
    if (facebookGroups !== undefined) settings.facebookGroups = facebookGroups;
    if (facebookKeywords !== undefined) settings.facebookKeywords = facebookKeywords;
    if (facebookDailyLimit !== undefined) settings.facebookDailyLimit = facebookDailyLimit;
    if (facebookAutoPostThreshold !== undefined) settings.facebookAutoPostThreshold = facebookAutoPostThreshold;
    if (twitterKeywords !== undefined) settings.twitterKeywords = twitterKeywords;
    if (twitterDailyLimit !== undefined) settings.twitterDailyLimit = twitterDailyLimit;
    if (twitterAutoPostThreshold !== undefined) settings.twitterAutoPostThreshold = twitterAutoPostThreshold;
    if (redditKeywords !== undefined) settings.redditKeywords = redditKeywords;
    if (redditDailyLimit !== undefined) settings.redditDailyLimit = redditDailyLimit;
    if (redditAutoPostThreshold !== undefined) settings.redditAutoPostThreshold = redditAutoPostThreshold;
    if (quoraKeywords !== undefined) settings.quoraKeywords = quoraKeywords;
    if (quoraDailyLimit !== undefined) settings.quoraDailyLimit = quoraDailyLimit;
    if (quoraAutoPostThreshold !== undefined) settings.quoraAutoPostThreshold = quoraAutoPostThreshold;
    if (youtubeKeywords !== undefined) settings.youtubeKeywords = youtubeKeywords;
    if (youtubeDailyLimit !== undefined) settings.youtubeDailyLimit = youtubeDailyLimit;
    if (youtubeAutoPostThreshold !== undefined) settings.youtubeAutoPostThreshold = youtubeAutoPostThreshold;
    if (pinterestKeywords !== undefined) settings.pinterestKeywords = pinterestKeywords;
    if (pinterestDailyLimit !== undefined) settings.pinterestDailyLimit = pinterestDailyLimit;
    if (pinterestAutoPostThreshold !== undefined) settings.pinterestAutoPostThreshold = pinterestAutoPostThreshold;
    // Competitor fields
    if (competitors !== undefined) settings.competitors = competitors;
    if (competitorAlertThreshold !== undefined) settings.competitorAlertThreshold = competitorAlertThreshold;
    // A/B Testing fields
    if (abTestingEnabled !== undefined) settings.abTestingEnabled = abTestingEnabled;
    if (abVariationCount !== undefined) settings.abVariationCount = abVariationCount;
    if (abTonePresets !== undefined) settings.abTonePresets = abTonePresets;
    if (abAutoOptimize !== undefined) settings.abAutoOptimize = abAutoOptimize;
    await settings.save();
  } else {
    settings = await Settings.create({
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
    });
  }

  // Log activity
  await ActivityLog.create({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: 'settings.updated',
    targetType: 'settings',
    targetId: (settings._id as { toString(): string }).toString(),
  });

  return NextResponse.json({ settings });
}
