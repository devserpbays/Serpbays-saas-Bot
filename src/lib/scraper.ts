import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { db } from '@/lib/db';
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
  const settings = await db.settings.findUnique({ where: { workspaceId } });
  if (!settings) {
    return { totalScraped: 0, newPosts: 0, errors: ['No settings found'] };
  }

  const userId = settings.userId;
  const enabledPlatforms = (settings.platforms as unknown as string[]) || [];
  const globalKeywords = (settings.keywords as unknown as string[]) || [];
  const errors: string[] = [];
  let totalScraped = 0;

  // Build scrape tasks for enabled platforms
  const tasks = PLATFORMS
    .filter((p) => enabledPlatforms.includes(p.name))
    .map(async (platform) => {
      try {
        const settingsRecord = settings as Record<string, unknown>;
        // Platform-specific keywords with global fallback
        const platformKeywords = (settingsRecord[platform.keywordsField] as string[]) || [];
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
          subreddits: (settings.subreddits as unknown as string[]) || [],
          facebookGroups: (settings.facebookGroups as unknown as string[]) || [],
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

  // Bulk insert: only create new posts, skip existing ones (by workspaceId+url unique)
  const result = await db.post.createMany({
    data: allPosts.map((post) => ({
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
    })),
    skipDuplicates: true,
  });

  return { totalScraped, newPosts: result.count, errors };
}
