import { chromium } from 'playwright';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { VerifyOptions, VerificationResult, ScrapeContext, ScrapedPost } from './types';
import { BROWSER_ARGS, DEFAULT_USER_AGENT, NAVIGATION_TIMEOUT } from './types';

export async function verifyRedditCookies(opts: VerifyOptions): Promise<VerificationResult> {
  const { cookieList, profileDir } = opts;

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
    await page.goto('https://www.reddit.com', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(3000);

    const url = page.url();
    if (url.includes('/login') || url.includes('/register')) {
      return { success: false, error: 'Cookies rejected — redirected to login page' };
    }

    // Try to get username via old.reddit.com which has simpler DOM
    let username = '';
    try {
      await page.goto('https://old.reddit.com', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
      await page.waitForTimeout(2000);
      const userLink = await page.$('span.user a[href*="/user/"]');
      if (userLink) {
        const href = await userLink.getAttribute('href');
        if (href) {
          const match = href.match(/\/user\/([^/?]+)/);
          if (match) username = match[1];
        }
      }
    } catch {}

    // Fallback: check for user dropdown on new reddit
    if (!username) {
      try {
        await page.goto('https://www.reddit.com', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
        await page.waitForTimeout(2000);
        const dropdown = await page.$('#USER_DROPDOWN_ID, button[id*="USER_DROPDOWN"], [data-testid="user-drawer-button"]');
        if (dropdown) {
          const text = await dropdown.textContent();
          if (text) username = text.trim();
        }
      } catch {}
    }

    const accountId = `rd_${username || 'unknown'}`;
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({ accountId, username, verifiedAt: new Date().toISOString() }));

    return { success: true, username, displayName: username, accountId, profileDir };
  } catch (err) {
    return { success: false, error: `Verification failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}

export async function scrapeReddit(ctx: ScrapeContext): Promise<ScrapedPost[]> {
  const { keywords, subreddits = [] } = ctx;
  const posts: ScrapedPost[] = [];
  const headers = { 'User-Agent': 'social-engagement-bot/1.0 (monitoring)' };
  const seen = new Set<string>();

  // Search globally for each keyword
  for (const keyword of keywords) {
    try {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&t=week&limit=25`;
      const res = await fetch(url, { headers });
      if (!res.ok) continue;

      const data = await res.json();
      for (const child of data?.data?.children || []) {
        const d = child.data;
        const permalink = `https://www.reddit.com${d.permalink}`;
        if (seen.has(permalink)) continue;
        seen.add(permalink);

        posts.push({
          url: permalink,
          platform: 'reddit',
          author: `u/${d.author}`,
          content: `${d.title}\n\n${d.selftext || ''}`.trim(),
          scrapedAt: new Date(d.created_utc * 1000),
          likeCount: d.ups || 0,
          replyCount: d.num_comments || 0,
        });
      }
    } catch {}

    await new Promise((r) => setTimeout(r, 2000));
  }

  // Search within specific subreddits
  for (const sub of subreddits) {
    for (const keyword of keywords) {
      try {
        const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/search.json?q=${encodeURIComponent(keyword)}&sort=new&t=week&limit=25&restrict_sr=on`;
        const res = await fetch(url, { headers });
        if (!res.ok) continue;

        const data = await res.json();
        for (const child of data?.data?.children || []) {
          const d = child.data;
          const permalink = `https://www.reddit.com${d.permalink}`;
          if (seen.has(permalink)) continue;
          seen.add(permalink);

          posts.push({
            url: permalink,
            platform: 'reddit',
            author: `u/${d.author}`,
            content: `${d.title}\n\n${d.selftext || ''}`.trim(),
            scrapedAt: new Date(d.created_utc * 1000),
            likeCount: d.ups || 0,
            replyCount: d.num_comments || 0,
          });
        }
      } catch {}

      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return posts;
}
