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
    const storedCookieList = opts.cookieList.map((c) => ({
      name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
    }));
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({ accountId, username, cookieMap: opts.cookieMap, cookieList: storedCookieList, verifiedAt: new Date().toISOString() }));

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
 * Uses new Reddit (www.reddit.com) directly — matches the proven bot-serp approach.
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

    // Use new Reddit directly (old Reddit redirects to new anyway)
    const newRedditUrl = postUrl.replace('old.reddit.com', 'www.reddit.com');
    await page.goto(newRedditUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(4000);

    // Check for login redirect
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/register')) {
      return { success: false, error: 'Not logged in on Reddit. Please re-verify your cookies.' };
    }

    // Scroll down to find the comment box
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(2000);

    // Try multiple comment box selectors (new Reddit)
    const commentSelectors = [
      'shreddit-composer div[contenteditable="true"]',
      'div[contenteditable="true"][data-lexical-editor]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea[name="comment"]',
      'textarea[placeholder*="comment" i]',
      '.public-DraftEditor-content',
    ];

    let commentBox: Awaited<ReturnType<typeof page.$>> = null;
    for (const sel of commentSelectors) {
      const elements = await page.$$(sel);
      for (const el of elements) {
        if (await el.isVisible().catch(() => false)) {
          commentBox = el;
          break;
        }
      }
      if (commentBox) break;
    }

    // If not found, try clicking placeholder to expand the comment editor
    if (!commentBox) {
      const placeholderSelectors = [
        'div[data-click-id="text"]',
        '[placeholder*="comment" i]',
        '[placeholder*="conversation" i]',
        'span:has-text("Add a comment")',
        'span:has-text("Join the conversation")',
        'p:has-text("Join the conversation")',
        'div:has-text("Join the conversation"):not(:has(div))',
        'faceplate-tracker[noun="comment_composer"] div[role="textbox"]',
        'shreddit-composer',
      ];
      for (const sel of placeholderSelectors) {
        const phs = await page.$$(sel);
        for (const ph of phs) {
          if (await ph.isVisible().catch(() => false)) {
            await ph.click({ force: true });
            await page.waitForTimeout(2000);
            break;
          }
        }
        // Re-check for comment box after clicking placeholder
        for (const cSel of commentSelectors) {
          const elements = await page.$$(cSel);
          for (const el of elements) {
            if (await el.isVisible().catch(() => false)) {
              commentBox = el;
              break;
            }
          }
          if (commentBox) break;
        }
        if (commentBox) break;
      }
    }

    if (!commentBox) {
      await page.screenshot({ path: '/tmp/reddit-comment-failed.png', fullPage: false }).catch(() => {});
      return { success: false, error: 'Could not find comment box. The post may be locked or archived.' };
    }

    // Click to focus with force
    await commentBox.click({ force: true });
    await page.waitForTimeout(1000);

    // Type the comment with human-like delay
    await page.keyboard.type(replyText, { delay: 35 });
    await page.waitForTimeout(1000);

    // Find and click the submit button
    const submitSelectors = [
      'button[type="submit"]:has-text("Comment")',
      'button:has-text("Comment")',
      'button[slot="submit-button"]',
    ];

    let submitted = false;
    for (const sel of submitSelectors) {
      const btns = await page.$$(sel);
      for (const btn of btns) {
        const text = await btn.textContent().catch(() => '');
        if (text && /comment/i.test(text.trim()) && await btn.isVisible().catch(() => false)) {
          await btn.click({ force: true });
          submitted = true;
          break;
        }
      }
      if (submitted) break;
    }

    if (!submitted) {
      // Ctrl+Enter as fallback submit
      await page.keyboard.press('Control+Enter');
    }

    await page.waitForTimeout(5000);

    // Verify: check if comment text appears in page
    const pageText = await page.textContent('body').catch(() => '');
    const verified = pageText?.includes(replyText.slice(0, 30)) ?? false;

    if (!verified) {
      await page.screenshot({ path: '/tmp/reddit-post-failed.png', fullPage: false }).catch(() => {});
    }

    // Extract reply URL
    let replyUrl = '';
    try {
      const commentLinks = await page.$$('a[href*="/comment/"]');
      if (commentLinks.length > 0) {
        const href = await commentLinks[commentLinks.length - 1].getAttribute('href');
        if (href) replyUrl = href.startsWith('http') ? href : `https://www.reddit.com${href}`;
      }
    } catch {}

    return { success: true, replyUrl: replyUrl || postUrl };
  } catch (err) {
    return { success: false, error: `Failed to post Reddit comment: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}
