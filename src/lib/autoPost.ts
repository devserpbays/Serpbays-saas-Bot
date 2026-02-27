import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { connectDB } from '@/lib/mongodb';
import Post from '@/models/Post';
import Settings from '@/models/Settings';
import ActivityLog from '@/models/ActivityLog';
import { getProfileDir } from '@/lib/profilePath';
import { postTwitterReply } from '@/lib/platforms/twitter';
import { postRedditReply } from '@/lib/platforms/reddit';
import { postFacebookReply } from '@/lib/platforms/facebook';
import { postQuoraReply } from '@/lib/platforms/quora';
import { postYoutubeReply } from '@/lib/platforms/youtube';
import { postPinterestReply } from '@/lib/platforms/pinterest';
import type { Cookie } from 'playwright';
import type { PostReplyContext, PostReplyResult } from '@/lib/platforms/types';
import type { AutoPostResult } from '@/lib/types';

const PLATFORMS = ['twitter', 'reddit', 'facebook', 'quora', 'youtube', 'pinterest'] as const;

const POSTER_MAP: Record<string, (ctx: PostReplyContext) => Promise<PostReplyResult>> = {
  twitter: postTwitterReply,
  reddit: postRedditReply,
  facebook: postFacebookReply,
  quora: postQuoraReply,
  youtube: postYoutubeReply,
  pinterest: postPinterestReply,
};

const DOMAIN_MAP: Record<string, string> = {
  twitter: '.x.com',
  reddit: '.reddit.com',
  facebook: '.facebook.com',
  quora: '.quora.com',
  youtube: '.youtube.com',
  pinterest: '.pinterest.com',
};

const DELAY_BETWEEN_POSTS_MS = 30_000; // 30 seconds between posts

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Auto-post all approved posts that are within daily limits.
 * Called after evaluation in the pipeline.
 */
export async function runAutoPost(workspaceId: string): Promise<AutoPostResult> {
  await connectDB();

  const result: AutoPostResult = { posted: 0, skipped: 0, errors: [], byPlatform: {} };

  const settings = await Settings.findOne({ workspaceId }).lean();
  if (!settings) return result;

  const settingsObj = settings as Record<string, unknown>;
  const userId = (settingsObj.userId as { toString(): string }).toString();
  const enabledPlatforms = (settingsObj.platforms as string[]) || [];

  // Build per-platform config: dailyLimit + account info
  const platformConfigs: Record<string, {
    dailyLimit: number;
    accountIndex: number;
    accountId: string;
  }> = {};

  const accounts = (settingsObj.socialAccounts as Array<{
    platform: string;
    accountIndex?: number;
    active?: boolean;
    id?: string;
  }>) || [];

  for (const platform of PLATFORMS) {
    if (!enabledPlatforms.includes(platform)) continue;

    const limitKey = `${platform}DailyLimit` as string;
    const dailyLimit = (settingsObj[limitKey] as number) ?? 5;

    const account = accounts.find((a) => a.platform === platform && a.active !== false);
    if (!account) continue;

    platformConfigs[platform] = {
      dailyLimit,
      accountIndex: account.accountIndex || 0,
      accountId: account.id || '',
    };
  }

  if (Object.keys(platformConfigs).length === 0) return result;

  // Count how many posts were already posted today per platform
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const postedToday = await Post.aggregate([
    {
      $match: {
        workspaceId: workspaceId,
        status: 'posted',
        postedAt: { $gte: todayStart },
      },
    },
    { $group: { _id: '$platform', count: { $sum: 1 } } },
  ]);

  const postedTodayMap: Record<string, number> = {};
  for (const entry of postedToday) {
    postedTodayMap[entry._id] = entry.count;
  }

  // Find approved posts, ordered by score (highest first)
  const approvedPosts = await Post.find({
    workspaceId,
    status: 'approved',
  })
    .sort({ aiRelevanceScore: -1 })
    .limit(50)
    .lean();

  if (!approvedPosts.length) return result;

  // Group posts by platform
  const postsByPlatform: Record<string, typeof approvedPosts> = {};
  for (const post of approvedPosts) {
    const p = post.platform as string;
    if (!platformConfigs[p]) {
      result.skipped++;
      continue;
    }
    if (!postsByPlatform[p]) postsByPlatform[p] = [];
    postsByPlatform[p].push(post);
  }

  let isFirstPost = true;

  for (const [platform, posts] of Object.entries(postsByPlatform)) {
    const config = platformConfigs[platform];
    const alreadyPosted = postedTodayMap[platform] || 0;
    const remaining = Math.max(0, config.dailyLimit - alreadyPosted);

    if (remaining === 0) {
      result.skipped += posts.length;
      continue;
    }

    // Load cookies for this platform
    const profileDir = getProfileDir(workspaceId, platform, config.accountIndex);
    let cookieMap: Record<string, string> = {};
    let accountId = config.accountId;

    const verifiedPath = join(profileDir, '.verified');
    if (existsSync(verifiedPath)) {
      try {
        const data = JSON.parse(readFileSync(verifiedPath, 'utf-8'));
        if (data.cookieMap) cookieMap = data.cookieMap;
        if (data.accountId) accountId = data.accountId;
      } catch { /* skip */ }
    }

    // Fallback to legacy userId-based path
    if (Object.keys(cookieMap).length === 0) {
      const legacyDir = getProfileDir(userId, platform, config.accountIndex);
      const legacyPath = join(legacyDir, '.verified');
      if (existsSync(legacyPath)) {
        try {
          const data = JSON.parse(readFileSync(legacyPath, 'utf-8'));
          if (data.cookieMap) cookieMap = data.cookieMap;
          if (data.accountId) accountId = data.accountId;
        } catch { /* skip */ }
      }
    }

    if (Object.keys(cookieMap).length === 0) {
      result.errors.push(`${platform}: no verified cookies`);
      result.skipped += posts.length;
      continue;
    }

    // Build cookie list for Playwright
    const domain = DOMAIN_MAP[platform] || `.${platform}.com`;
    const ninetyDays = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
    const cookieList: Cookie[] = Object.entries(cookieMap).map(([name, value]) => ({
      name,
      value,
      domain,
      path: '/',
      expires: ninetyDays,
      httpOnly: false,
      secure: true,
      sameSite: 'Lax' as const,
    }));

    const poster = POSTER_MAP[platform];
    if (!poster) {
      result.skipped += posts.length;
      continue;
    }

    // Post up to daily limit
    const toPost = posts.slice(0, remaining);
    result.skipped += posts.length - toPost.length;

    for (const post of toPost) {
      // Delay between posts (skip first)
      if (!isFirstPost) {
        await sleep(DELAY_BETWEEN_POSTS_MS);
      }
      isFirstPost = false;

      // Determine reply text: editedReply > selected variation > aiReply
      let replyText = '';
      let postedTone = '';

      if (post.editedReply) {
        replyText = post.editedReply as string;
      } else if (
        (post.aiReplies as Array<{ text: string; tone: string; selected: boolean }> | undefined)?.length &&
        typeof post.selectedVariationIndex === 'number' &&
        post.selectedVariationIndex >= 0
      ) {
        const variations = post.aiReplies as Array<{ text: string; tone: string }>;
        const variation = variations[post.selectedVariationIndex as number];
        if (variation) {
          replyText = variation.text;
          postedTone = variation.tone || '';
        }
      }

      if (!replyText && post.aiReply) {
        replyText = post.aiReply as string;
        postedTone = (post.aiTone as string) || '';
      }

      if (!replyText) {
        result.skipped++;
        continue;
      }

      try {
        const postResult = await poster({
          postUrl: post.url as string,
          replyText,
          cookieMap,
          cookieList,
          profileDir,
        });

        if (postResult.success) {
          await Post.updateOne(
            { _id: post._id },
            {
              $set: {
                status: 'posted',
                postedAt: new Date(),
                autoPosted: true,
                postedByAccount: accountId,
                replyUrl: postResult.replyUrl || '',
                postedTone,
              },
            }
          );

          await ActivityLog.create({
            workspaceId,
            userId,
            action: 'post.auto_posted',
            targetType: 'post',
            targetId: (post._id as { toString(): string }).toString(),
            meta: {
              platform,
              replyUrl: postResult.replyUrl || '',
              score: post.aiRelevanceScore,
              accountId,
            },
          }).catch(() => { /* silent */ });

          result.posted++;
          result.byPlatform[platform] = (result.byPlatform[platform] || 0) + 1;
        } else {
          result.errors.push(`${platform}: ${postResult.error || 'unknown error'}`);
          result.skipped++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${platform}: ${msg}`);
        result.skipped++;
        console.error(`Auto-post failed for ${platform} post ${post._id}:`, err);
      }
    }
  }

  return result;
}
