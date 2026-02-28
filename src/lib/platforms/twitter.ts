import { chromium } from 'playwright';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { VerifyOptions, VerificationResult, ScrapeContext, ScrapedPost, PostReplyContext, PostReplyResult } from './types';
import { BROWSER_ARGS, DEFAULT_USER_AGENT, NAVIGATION_TIMEOUT } from './types';

const TWITTER_BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

export async function verifyTwitterCookies(opts: VerifyOptions): Promise<VerificationResult> {
  const { cookieList, cookieMap, profileDir } = opts;

  if (!cookieMap['auth_token'] || !cookieMap['ct0']) {
    return { success: false, error: 'Missing required cookies: auth_token, ct0' };
  }

  mkdirSync(profileDir, { recursive: true });
  try { unlinkSync(join(profileDir, 'SingletonLock')); } catch {}

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: BROWSER_ARGS,
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });

  try {
    await context.addCookies(cookieList);
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(3000);

    const url = page.url();
    if (url.includes('/login') || url.includes('/i/flow/login')) {
      return { success: false, error: 'Cookies rejected — redirected to login page' };
    }

    // Extract username from profile link
    let username = '';
    try {
      const profileLink = await page.$('a[data-testid="AppTabBar_Profile_Link"]');
      if (profileLink) {
        const href = await profileLink.getAttribute('href');
        if (href) username = href.replace('/', '');
      }
    } catch {}

    // Fallback: extract from twid cookie
    if (!username && cookieMap['twid']) {
      const decoded = decodeURIComponent(cookieMap['twid']);
      username = decoded.replace('u=', '');
    }

    // Extract display name
    let displayName = '';
    try {
      const switcher = await page.$('[data-testid="SideNav_AccountSwitcher_Button"]');
      if (switcher) {
        const spans = await switcher.$$('span');
        for (const span of spans) {
          const text = (await span.textContent())?.trim();
          if (text && !text.startsWith('@')) {
            displayName = text;
            break;
          }
        }
      }
    } catch {}

    const accountId = `tw_${username || 'unknown'}`;
    const storedCookieList = cookieList.map((c) => ({
      name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
    }));
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({ accountId, username, displayName, cookieMap, cookieList: storedCookieList, verifiedAt: new Date().toISOString() }));

    return { success: true, username, displayName, accountId, profileDir };
  } catch (err) {
    return { success: false, error: `Verification failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}

export async function scrapeTwitter(ctx: ScrapeContext): Promise<ScrapedPost[]> {
  const { keywords, cookieMap } = ctx;
  const posts: ScrapedPost[] = [];

  if (!cookieMap['auth_token'] || !cookieMap['ct0']) return posts;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${TWITTER_BEARER}`,
    'Content-Type': 'application/json',
    'X-Csrf-Token': cookieMap['ct0'],
    'X-Twitter-Auth-Type': 'OAuth2Session',
    'X-Twitter-Active-User': 'yes',
    'X-Twitter-Client-Language': 'en',
    Cookie: `auth_token=${cookieMap['auth_token']}; ct0=${cookieMap['ct0']}`,
    'User-Agent': DEFAULT_USER_AGENT,
  };

  for (const keyword of keywords) {
    try {
      const params = new URLSearchParams({
        q: keyword,
        tweet_search_mode: 'live',
        query_source: 'typed_query',
        count: '20',
        include_entities: 'true',
        tweet_mode: 'extended',
      });

      const res = await fetch(
        `https://x.com/i/api/2/search/adaptive.json?${params}`,
        { headers }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const tweets = data?.globalObjects?.tweets || {};
      const users = data?.globalObjects?.users || {};

      for (const [tweetId, tweet] of Object.entries(tweets) as [string, Record<string, unknown>][]) {
        const legacy = tweet as Record<string, unknown>;
        const userId = legacy.user_id_str as string;
        const user = (users as Record<string, Record<string, unknown>>)[userId];
        const screenName = (user?.screen_name as string) || 'unknown';
        const fullText = (legacy.full_text as string) || '';

        posts.push({
          url: `https://x.com/${screenName}/status/${tweetId}`,
          platform: 'twitter',
          author: `@${screenName}`,
          content: fullText,
          scrapedAt: new Date(),
          likeCount: (legacy.favorite_count as number) || 0,
          replyCount: (legacy.reply_count as number) || 0,
          viewCount: 0,
        });
      }

      // Rate limit delay
      if (keywords.indexOf(keyword) < keywords.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch {}
  }

  return posts;
}

/**
 * Post a reply to a tweet using Twitter's v1.1 API.
 * Extracts the tweet ID from the post URL and sends a reply.
 */
export async function postTwitterReply(ctx: PostReplyContext): Promise<PostReplyResult> {
  const { postUrl, replyText, cookieMap } = ctx;

  if (!cookieMap['auth_token'] || !cookieMap['ct0']) {
    return { success: false, error: 'Missing required cookies: auth_token, ct0' };
  }

  // Extract tweet ID from URL: https://x.com/{user}/status/{tweetId}
  const tweetIdMatch = postUrl.match(/\/status\/(\d+)/);
  if (!tweetIdMatch) {
    return { success: false, error: 'Could not extract tweet ID from URL' };
  }
  const tweetId = tweetIdMatch[1];

  const headers: Record<string, string> = {
    Authorization: `Bearer ${TWITTER_BEARER}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Csrf-Token': cookieMap['ct0'],
    'X-Twitter-Auth-Type': 'OAuth2Session',
    'X-Twitter-Active-User': 'yes',
    'X-Twitter-Client-Language': 'en',
    Cookie: `auth_token=${cookieMap['auth_token']}; ct0=${cookieMap['ct0']}`,
    'User-Agent': DEFAULT_USER_AGENT,
  };

  try {
    const body = new URLSearchParams({
      status: replyText,
      in_reply_to_status_id: tweetId,
      auto_populate_reply_metadata: 'true',
    });

    const res = await fetch('https://x.com/i/api/1.1/statuses/update.json', {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return { success: false, error: `Twitter API error ${res.status}: ${errorText.slice(0, 200)}` };
    }

    const data = await res.json();
    const replyId = data.id_str;
    const screenName = data.user?.screen_name || 'unknown';
    const replyUrl = replyId
      ? `https://x.com/${screenName}/status/${replyId}`
      : '';

    return { success: true, replyUrl };
  } catch (err) {
    return { success: false, error: `Failed to post tweet: ${err instanceof Error ? err.message : String(err)}` };
  }
}
