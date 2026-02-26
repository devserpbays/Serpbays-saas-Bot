import { chromium } from 'playwright';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { VerifyOptions, VerificationResult, ScrapeContext, ScrapedPost, PostReplyContext, PostReplyResult } from './types';
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
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({ accountId, username, cookieMap: opts.cookieMap, verifiedAt: new Date().toISOString() }));

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

/**
 * Post a comment reply to a Reddit post using Playwright browser automation.
 * Navigates to the post, finds the comment box, types the reply, and submits.
 */
export async function postRedditReply(ctx: PostReplyContext): Promise<PostReplyResult> {
  const { postUrl, replyText, cookieList, profileDir } = ctx;

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

    // Navigate to the post on old.reddit.com for simpler DOM
    const oldRedditUrl = postUrl.replace('www.reddit.com', 'old.reddit.com');
    await page.goto(oldRedditUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(3000);

    // Check if logged in
    const loginLink = await page.$('a.login-required');
    const userBar = await page.$('span.user a[href*="/user/"]');
    if (loginLink && !userBar) {
      return { success: false, error: 'Not logged in on Reddit. Please re-verify your cookies.' };
    }

    // Find the comment textarea on old reddit
    const commentBox = await page.$('textarea[name="text"]');
    if (!commentBox) {
      return { success: false, error: 'Could not find comment box. The post may be locked or archived.' };
    }

    await commentBox.click();
    await commentBox.fill(replyText);
    await page.waitForTimeout(500);

    // Click the save/submit button
    const submitBtn = await page.$('button[type="submit"].save, button:has-text("save"), input[type="submit"][value="save"]');
    if (!submitBtn) {
      return { success: false, error: 'Could not find submit button for comment.' };
    }

    await submitBtn.click();
    await page.waitForTimeout(4000);

    // Check for errors
    const errorEl = await page.$('.error, .status-error');
    if (errorEl) {
      const errorText = (await errorEl.textContent())?.trim() || '';
      if (errorText) {
        return { success: false, error: `Reddit error: ${errorText}` };
      }
    }

    // Try to extract the comment permalink
    let replyUrl = '';
    try {
      // On old reddit, new comments appear with a permalink
      const permalinks = await page.$$('.comment .bylink[href*="/comment/"], .comment a.bylink');
      if (permalinks.length > 0) {
        const lastPermalink = permalinks[permalinks.length - 1];
        const href = await lastPermalink.getAttribute('href');
        if (href) {
          replyUrl = href.startsWith('http') ? href : `https://old.reddit.com${href}`;
        }
      }
    } catch {}

    // Fallback: use the post URL itself
    if (!replyUrl) replyUrl = postUrl;

    return { success: true, replyUrl };
  } catch (err) {
    return { success: false, error: `Failed to post Reddit comment: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}
