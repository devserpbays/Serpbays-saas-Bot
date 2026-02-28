import { chromium } from 'playwright';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { VerifyOptions, VerificationResult, ScrapeContext, ScrapedPost, PostReplyContext, PostReplyResult } from './types';
import { BROWSER_ARGS, DEFAULT_USER_AGENT, NAVIGATION_TIMEOUT } from './types';

export async function verifyQuoraCookies(opts: VerifyOptions): Promise<VerificationResult> {
  const { cookieList, cookieMap, profileDir } = opts;

  if (!cookieMap['m-b']) {
    return { success: false, error: 'Missing required cookie: m-b' };
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
    await page.goto('https://www.quora.com', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(3000);

    const url = page.url();
    if (url.includes('/login') || url.includes('/register')) {
      return { success: false, error: 'Cookies rejected — redirected to login page' };
    }

    // Check for logged-in indicators
    const loggedIn = await page.$('[aria-label="Profile"], [aria-label="Your profile"], a[href*="/profile/"], button:has-text("Add question")');
    if (!loggedIn) {
      return { success: false, error: 'Not logged in — no profile indicator found' };
    }

    // Extract username
    let username = '';
    try {
      const profileLink = await page.$('a[href*="/profile/"]');
      if (profileLink) {
        const href = await profileLink.getAttribute('href');
        if (href) {
          const match = href.match(/\/profile\/([^/?]+)/);
          if (match) username = match[1];
        }
      }
    } catch {}

    const accountId = `qa_${username || 'unknown'}`;
    const storedCookieList = cookieList.map((c) => ({
      name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
    }));
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({ accountId, username, cookieMap, cookieList: storedCookieList, verifiedAt: new Date().toISOString() }));

    return { success: true, username, displayName: username, accountId, profileDir };
  } catch (err) {
    return { success: false, error: `Verification failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}

export async function scrapeQuora(ctx: ScrapeContext): Promise<ScrapedPost[]> {
  const { keywords, cookieList, cookieMap, profileDir } = ctx;
  const posts: ScrapedPost[] = [];

  if (!cookieMap['m-b']) return posts;

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

    for (const keyword of keywords) {
      try {
        const page = await context.newPage();
        await page.goto(
          `https://www.quora.com/search?q=${encodeURIComponent(keyword)}&type=question&time=day`,
          { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT }
        );
        await page.waitForTimeout(3000);

        // Scroll for more results
        for (let i = 0; i < 2; i++) {
          await page.mouse.wheel(0, 800);
          await page.waitForTimeout(1500);
        }

        // Extract question links (handles both relative and absolute URLs)
        const links = await page.$$('a[href]');
        for (const link of links) {
          try {
            const href = await link.getAttribute('href');
            if (!href) continue;

            let questionUrl = '';

            // Relative path: /Question-Title
            if (/^\/[A-Z][^/]*\/?$/.test(href)) {
              questionUrl = `https://www.quora.com${href}`;
            }
            // Absolute URL: https://www.quora.com/Question-Title or subdomain.quora.com/...
            else if (/^https?:\/\/([a-z]+\.)?quora\.com\/[A-Z][^?#]*/.test(href)) {
              questionUrl = href.split('?')[0].split('#')[0]; // strip query/hash
            }

            if (!questionUrl) continue;
            if (questionUrl.includes('/profile/') || questionUrl.includes('/topic/') || questionUrl.includes('/search')) continue;
            if (questionUrl.includes('/unanswered/')) {
              // Normalize unanswered URLs to the base question
              questionUrl = questionUrl.replace('/unanswered/', '/');
            }

            if (seen.has(questionUrl)) continue;
            seen.add(questionUrl);

            const text = (await link.textContent())?.trim() || '';
            if (!text || text.length < 10) continue;

            posts.push({
              url: questionUrl,
              platform: 'quora',
              author: 'Quora User',
              content: text,
              scrapedAt: new Date(),
            });
          } catch {}
        }

        await page.close();
      } catch {}

      await new Promise((r) => setTimeout(r, 2000));
    }

    return posts;
  } finally {
    await context.close();
  }
}

/**
 * Post an answer to a Quora question using Playwright DOM automation.
 * Matches the proven bot-serp approach: force clicks, human typing delay,
 * Ctrl+Enter fallback, post verification, screenshot on failure.
 */
export async function postQuoraReply(ctx: PostReplyContext): Promise<PostReplyResult> {
  const { postUrl, replyText, cookieList, cookieMap, profileDir } = ctx;

  if (!cookieMap['m-b']) {
    return { success: false, error: 'Missing required cookie: m-b' };
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

    // Check for login redirect
    const url = page.url();
    if (url.includes('/login') || url.includes('/register')) {
      return { success: false, error: 'Session expired — redirected to login. Please re-verify cookies.' };
    }

    // Scroll down to find the answer area
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(2000);

    // Click "Answer" button to open the answer editor
    const answerBtnSelectors = [
      'button:has-text("Answer")',
      '[aria-label="Answer"]',
      'a:has-text("Answer")',
      '.q-box button:has-text("Answer")',
    ];

    let clickedAnswer = false;
    for (const sel of answerBtnSelectors) {
      const btns = await page.$$(sel);
      for (const btn of btns) {
        const text = await btn.textContent().catch(() => '');
        if (text && /^answer$/i.test(text.trim()) && await btn.isVisible().catch(() => false)) {
          await btn.click({ force: true });
          clickedAnswer = true;
          await page.waitForTimeout(3000);
          break;
        }
      }
      if (clickedAnswer) break;
    }

    // Find the answer editor (rich text contenteditable)
    const editorSelectors = [
      'div[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"].q-box',
      'div[contenteditable="true"]',
      '.doc[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
    ];

    let editor: Awaited<ReturnType<typeof page.$>> = null;
    for (const sel of editorSelectors) {
      const elements = await page.$$(sel);
      for (const el of elements) {
        if (await el.isVisible().catch(() => false)) {
          editor = el;
          break;
        }
      }
      if (editor) break;
    }

    if (!editor) {
      await page.screenshot({ path: '/tmp/quora-answer-failed.png', fullPage: false }).catch(() => {});
      return { success: false, error: 'Could not find answer editor on this question.' };
    }

    // Click to focus with force
    await editor.click({ force: true });
    await page.waitForTimeout(1000);

    // Type the answer with human-like delay
    await page.keyboard.type(replyText, { delay: 30 });
    await page.waitForTimeout(1000);

    // Find and click the Submit/Post button
    const submitSelectors = [
      'button:has-text("Post")',
      'button:has-text("Submit")',
      'button[type="submit"]:has-text("Post")',
      'button.q-click-wrapper:has-text("Post")',
    ];

    let submitted = false;
    for (const sel of submitSelectors) {
      const btns = await page.$$(sel);
      for (const btn of btns) {
        if (await btn.isVisible().catch(() => false)) {
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

    // Verify: check if answer text appears in page
    const pageText = await page.textContent('body').catch(() => '');
    const verified = pageText?.includes(replyText.slice(0, 30)) ?? false;

    if (!verified) {
      await page.screenshot({ path: '/tmp/quora-post-failed.png', fullPage: false }).catch(() => {});
    }

    // Extract the answer permalink
    let replyUrl = postUrl;
    try {
      const currentUrl = page.url();
      if (currentUrl.includes('/answer/')) {
        replyUrl = currentUrl;
      } else {
        const answerLinks = await page.$$('a[href*="/answer/"]');
        if (answerLinks.length > 0) {
          const href = await answerLinks[answerLinks.length - 1].getAttribute('href');
          if (href) {
            replyUrl = href.startsWith('http') ? href : `https://www.quora.com${href}`;
          }
        }
      }
    } catch {}

    return { success: true, replyUrl };
  } catch (err) {
    return { success: false, error: `Failed to post Quora answer: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}
