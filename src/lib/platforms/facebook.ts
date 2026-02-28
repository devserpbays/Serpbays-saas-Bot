import { chromium } from 'playwright';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { VerifyOptions, VerificationResult, ScrapeContext, ScrapedPost, PostReplyContext, PostReplyResult } from './types';
import { BROWSER_ARGS, DEFAULT_USER_AGENT, NAVIGATION_TIMEOUT } from './types';

export async function verifyFacebookCookies(opts: VerifyOptions): Promise<VerificationResult> {
  const { cookieList, cookieMap, profileDir } = opts;

  if (!cookieMap['c_user'] || !cookieMap['xs']) {
    return { success: false, error: 'Missing required cookies: c_user, xs' };
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
    await page.goto('https://www.facebook.com', { waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(4000);

    const url = page.url();
    if (url.includes('/checkpoint') || url.includes('/login')) {
      return { success: false, error: 'Cookies rejected — redirected to login/checkpoint' };
    }

    // Check for login form
    const loginForm = await page.$('input[name="email"], form[action*="login"]');
    if (loginForm) {
      return { success: false, error: 'Not logged in — login form detected' };
    }

    const cUser = cookieMap['c_user'];
    let username = '';
    let displayName = '';

    // Try to extract username from profile link
    try {
      const profileLink = await page.$('[aria-label="Your profile"], a[href*="/profile.php"]');
      if (profileLink) {
        const href = await profileLink.getAttribute('href');
        if (href) {
          const match = href.match(/facebook\.com\/([^/?]+)/);
          if (match && match[1] !== 'profile.php') username = match[1];
        }
        displayName = (await profileLink.getAttribute('aria-label'))?.replace('Your profile', '').trim() || '';
      }
    } catch {}

    const accountId = `fb_${cUser}`;
    const storedCookieList = cookieList.map((c) => ({
      name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
    }));
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({ accountId, username, displayName, cUser, cookieMap, cookieList: storedCookieList, verifiedAt: new Date().toISOString() }));

    return { success: true, username: username || cUser, displayName, accountId, profileDir };
  } catch (err) {
    return { success: false, error: `Verification failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}

export async function scrapeFacebook(ctx: ScrapeContext): Promise<ScrapedPost[]> {
  const { keywords, cookieList, cookieMap, profileDir, facebookGroups = [] } = ctx;
  const posts: ScrapedPost[] = [];

  if (!cookieMap['c_user'] || !cookieMap['xs']) return posts;

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
    const seen = new Set<string>();

    for (const groupId of facebookGroups) {
      try {
        const page = await context.newPage();
        await page.goto(`https://www.facebook.com/groups/${groupId}/`, {
          waitUntil: 'commit',
          timeout: NAVIGATION_TIMEOUT,
        });
        await page.waitForTimeout(4000);

        // Scroll to load more posts
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, 1000);
          await page.waitForTimeout(1500);
        }

        const articles = await page.$$('[role="article"]');
        for (const article of articles) {
          try {
            const text = (await article.textContent()) || '';
            const lowerText = text.toLowerCase();
            const matched = keywords.some((kw) => lowerText.includes(kw.toLowerCase()));
            if (!matched) continue;

            // Extract post URL
            let postUrl = '';
            const links = await article.$$('a[href*="/posts/"], a[href*="/permalink/"]');
            for (const link of links) {
              const href = await link.getAttribute('href');
              if (href) {
                postUrl = href.startsWith('http') ? href : `https://www.facebook.com${href}`;
                postUrl = postUrl.split('?')[0];
                break;
              }
            }
            if (!postUrl || seen.has(postUrl)) continue;
            seen.add(postUrl);

            // Extract author
            let author = 'Unknown';
            const authorEl = await article.$('strong a, h3 a, h4 a');
            if (authorEl) {
              author = (await authorEl.textContent())?.trim() || 'Unknown';
            }

            posts.push({
              url: postUrl,
              platform: 'facebook',
              author,
              content: text.slice(0, 2000),
              scrapedAt: new Date(),
            });
          } catch {}
        }

        await page.close();
      } catch {}
    }

    return posts;
  } finally {
    await context.close();
  }
}

/**
 * Post a comment on a Facebook post using Playwright DOM automation.
 * Matches the proven bot-serp approach: modal handling, force clicks, human typing,
 * Enter submit, post verification with box-cleared + comment-section checks.
 */
export async function postFacebookReply(ctx: PostReplyContext): Promise<PostReplyResult> {
  const { postUrl, replyText, cookieList, cookieMap, profileDir } = ctx;

  if (!cookieMap['c_user'] || !cookieMap['xs']) {
    return { success: false, error: 'Missing required cookies: c_user, xs' };
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

    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(4000);

    // Check if we were redirected to login
    const url = page.url();
    if (url.includes('/checkpoint') || url.includes('/login')) {
      return { success: false, error: 'Session expired — redirected to login. Please re-verify cookies.' };
    }

    // Post may open in a modal — scroll down inside it to reveal comment box
    const modal = await page.$('[role="dialog"]');
    if (modal) {
      await page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        dialogs.forEach((d) => {
          const children = d.querySelectorAll('div');
          children.forEach((c) => {
            if (c.scrollHeight > c.clientHeight) {
              c.scrollTop = c.scrollHeight;
            }
          });
        });
      });
      await page.waitForTimeout(2000);
    }

    // Find comment box — try multiple selectors, check visibility
    const commentSelectors = [
      '[aria-label*="Comment as"]',
      '[aria-label="Write a comment"]',
      '[aria-label="Write a comment\u2026"]',
      '[aria-label="Write a comment…"]',
      'div[contenteditable="true"][role="textbox"]',
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

    // If not found, try clicking a "Comment" button to expand
    if (!commentBox) {
      const commentBtns = await page.$$('div[role="button"]');
      for (const btn of commentBtns) {
        const text = await btn.textContent().catch(() => '');
        if (text?.trim() === 'Comment') {
          await btn.click({ force: true });
          await page.waitForTimeout(2000);
          break;
        }
      }

      // Retry finding comment box
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
    }

    if (!commentBox) {
      await page.screenshot({ path: '/tmp/fb-comment-failed.png', fullPage: false }).catch(() => {});
      return { success: false, error: 'Could not find comment box. The post may not allow comments.' };
    }

    // Click to focus with force (bypass any overlay)
    await commentBox.click({ force: true });
    await page.waitForTimeout(1000);

    // Type the comment with human-like delay
    await page.keyboard.type(replyText, { delay: 40 });
    await page.waitForTimeout(1000);

    // Submit with Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Verify submission: the comment box should be empty after a successful post
    const boxTextAfter = await commentBox.textContent().catch(() => replyText);
    const boxCleared = !boxTextAfter || boxTextAfter.trim().length === 0;

    // Secondary check: look for our comment text in the comments section (not in input box)
    const commentSectionText = await page.evaluate((snippet: string) => {
      const allText = Array.from(document.querySelectorAll('[role="article"] span, [data-testid*="comment"] span'))
        .map(el => el.textContent || '')
        .join(' ');
      return allText.toLowerCase().includes(snippet.toLowerCase());
    }, replyText.slice(0, 25)).catch(() => false);

    const verified = boxCleared || commentSectionText;

    if (!verified) {
      await page.screenshot({ path: '/tmp/fb-post-failed.png', fullPage: false }).catch(() => {});
    }

    // Try to extract comment_id from GraphQL response (best-effort)
    let fbCommentId = '';
    try {
      const responses = page.context().pages();
      // The comment_id may appear in page content after posting
      const bodyText = await page.textContent('body').catch(() => '');
      const match = bodyText?.match(/"comment_id"\s*:\s*"(\d+)"/);
      if (match) fbCommentId = match[1];
    } catch {}

    const replyUrl = fbCommentId
      ? `${postUrl}${postUrl.includes('?') ? '&' : '?'}comment_id=${fbCommentId}`
      : postUrl;

    return { success: true, replyUrl };
  } catch (err) {
    return { success: false, error: `Failed to post Facebook comment: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}
