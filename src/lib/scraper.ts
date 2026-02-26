import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { connectDB } from '@/lib/mongodb';
import Post from '@/models/Post';
import Settings from '@/models/Settings';
import { getProfileDir } from '@/lib/profilePath';
import { scrapeTwitter } from '@/lib/platforms/twitter';
import { scrapeReddit } from '@/lib/platforms/reddit';
import { scrapeFacebook } from '@/lib/platforms/facebook';
import { scrapeQuora } from '@/lib/platforms/quora';
import { scrapeYoutube } from '@/lib/platforms/youtube';
import { scrapePinterest } from '@/lib/platforms/pinterest';
import type { ScrapeResult } from '@/lib/types';
import type { ScrapeContext, ScrapedPost } from '@/lib/platforms/types';

interface PlatformConfig {
  name: string;
  keywordsField: string;
  defaultDomain: string;
  requiresCookies: boolean;
  scrape: (ctx: ScrapeContext) => Promise<ScrapedPost[]>;
}

const PLATFORMS: PlatformConfig[] = [
  { name: 'twitter', keywordsField: 'twitterKeywords', defaultDomain: '.x.com', requiresCookies: true, scrape: scrapeTwitter },
  { name: 'reddit', keywordsField: 'redditKeywords', defaultDomain: '.reddit.com', requiresCookies: false, scrape: scrapeReddit },
  { name: 'facebook', keywordsField: 'facebookKeywords', defaultDomain: '.facebook.com', requiresCookies: true, scrape: scrapeFacebook },
  { name: 'quora', keywordsField: 'quoraKeywords', defaultDomain: '.quora.com', requiresCookies: true, scrape: scrapeQuora },
  { name: 'youtube', keywordsField: 'youtubeKeywords', defaultDomain: '.youtube.com', requiresCookies: false, scrape: scrapeYoutube },
  { name: 'pinterest', keywordsField: 'pinterestKeywords', defaultDomain: '.pinterest.com', requiresCookies: true, scrape: scrapePinterest },
];

export async function runScrape(workspaceId: string): Promise<ScrapeResult> {
  await connectDB();

  const settings = await Settings.findOne({ workspaceId }).lean();
  if (!settings) {
    return { totalScraped: 0, newPosts: 0, errors: ['No settings found'] };
  }

  const settingsObj = settings as Record<string, unknown>;
  const userId = (settingsObj.userId as { toString(): string }).toString();
  const enabledPlatforms = (settings.platforms as string[]) || [];
  const globalKeywords = (settings.keywords as string[]) || [];
  const errors: string[] = [];
  let totalScraped = 0;

  // Build scrape tasks for enabled platforms
  const tasks = PLATFORMS
    .filter((p) => enabledPlatforms.includes(p.name))
    .map(async (platform) => {
      try {
        // Platform-specific keywords with global fallback
        const platformKeywords = (settingsObj[platform.keywordsField] as string[]) || [];
        const keywords = platformKeywords.length > 0 ? platformKeywords : globalKeywords;
        if (!keywords.length) return [];

        // Build cookie context from connected social accounts
        const accounts = (settings.socialAccounts as Array<{ platform: string; accountIndex?: number; active?: boolean }>) || [];
        const account = accounts.find((a) => a.platform === platform.name && a.active !== false);
        const accountIndex = account?.accountIndex || 0;
        const profileDir = getProfileDir(workspaceId, platform.name, accountIndex);

        let cookieList: ScrapeContext['cookieList'] = [];
        let cookieMap: ScrapeContext['cookieMap'] = {};

        // Load saved cookies from the .verified profile file
        const verifiedPath = join(profileDir, '.verified');
        if (existsSync(verifiedPath)) {
          try {
            const data = JSON.parse(readFileSync(verifiedPath, 'utf-8'));
            if (data.cookieMap) {
              cookieMap = data.cookieMap;
            }
          } catch {}
        }

        // Also check legacy userId-based path
        if (Object.keys(cookieMap).length === 0) {
          const legacyDir = getProfileDir(userId, platform.name, accountIndex);
          const legacyPath = join(legacyDir, '.verified');
          if (existsSync(legacyPath)) {
            try {
              const data = JSON.parse(readFileSync(legacyPath, 'utf-8'));
              if (data.cookieMap) {
                cookieMap = data.cookieMap;
              }
            } catch {}
          }
        }

        // Skip cookie-dependent platforms with no stored cookies
        if (platform.requiresCookies && Object.keys(cookieMap).length === 0) {
          return [];
        }

        const ctx: ScrapeContext = {
          keywords,
          cookieMap,
          cookieList,
          profileDir,
          subreddits: (settings.subreddits as string[]) || [],
          facebookGroups: (settings.facebookGroups as string[]) || [],
        };

        return await platform.scrape(ctx);
      } catch (err) {
        errors.push(`${platform.name}: ${err instanceof Error ? err.message : String(err)}`);
        return [];
      }
    });

  const results = await Promise.all(tasks);
  const allPosts = results.flat();
  totalScraped = allPosts.length;

  if (!allPosts.length) {
    return { totalScraped: 0, newPosts: 0, errors };
  }

  // Bulk upsert: only insert new posts, skip existing ones
  const ops = allPosts.map((post) => ({
    updateOne: {
      filter: { workspaceId, url: post.url },
      update: {
        $setOnInsert: {
          userId,
          workspaceId,
          url: post.url,
          platform: post.platform,
          author: post.author,
          content: post.content,
          scrapedAt: post.scrapedAt,
          status: 'new',
          likeCount: post.likeCount || 0,
          replyCount: post.replyCount || 0,
          viewCount: post.viewCount || 0,
        },
      },
      upsert: true,
    },
  }));

  const bulkResult = await Post.bulkWrite(ops, { ordered: false });
  const newPosts = bulkResult.upsertedCount || 0;

  return { totalScraped, newPosts, errors };
}
