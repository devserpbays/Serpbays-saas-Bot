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
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({ accountId, username, displayName, cUser, cookieMap, verifiedAt: new Date().toISOString() }));

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
 * Navigates to the post URL, finds the comment box, types the reply, and submits.
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

    await page.goto(postUrl, { waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(4000);

    // Check if we were redirected to login
    const url = page.url();
    if (url.includes('/checkpoint') || url.includes('/login')) {
      return { success: false, error: 'Session expired — redirected to login. Please re-verify cookies.' };
    }

    // Try to find and click the comment input area
    // Facebook uses contenteditable divs with specific aria labels or form roles
    const commentSelectors = [
      '[aria-label="Write a comment…"]',
      '[aria-label="Write a comment"]',
      '[aria-label="Comment"]',
      'div[contenteditable="true"][role="textbox"][aria-label*="comment" i]',
      'div[contenteditable="true"][role="textbox"][aria-label*="Comment" i]',
      'form[role="presentation"] div[contenteditable="true"]',
    ];

    let commentBox = null;
    for (const selector of commentSelectors) {
      commentBox = await page.$(selector);
      if (commentBox) break;
    }

    // If no comment box visible, try scrolling to load comments section
    if (!commentBox) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(2000);

      // Try clicking "Comment" action link to open the comment box
      const commentAction = await page.$('[aria-label="Leave a comment"], [aria-label="Comment"], span:has-text("Comment")');
      if (commentAction) {
        await commentAction.click();
        await page.waitForTimeout(2000);
      }

      for (const selector of commentSelectors) {
        commentBox = await page.$(selector);
        if (commentBox) break;
      }
    }

    if (!commentBox) {
      return { success: false, error: 'Could not find comment box. The post may not allow comments.' };
    }

    // Click the comment box to focus it
    await commentBox.click();
    await page.waitForTimeout(500);

    // Type the reply character by character for contenteditable
    await page.keyboard.type(replyText, { delay: 20 });
    await page.waitForTimeout(1000);

    // Submit with Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    // The posted comment URL is typically the post URL itself
    // Facebook doesn't easily expose individual comment permalinks via DOM
    const replyUrl = postUrl;

    return { success: true, replyUrl };
  } catch (err) {
    return { success: false, error: `Failed to post Facebook comment: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}
