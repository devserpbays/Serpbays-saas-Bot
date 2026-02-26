import { chromium } from 'playwright';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { VerifyOptions, VerificationResult, ScrapeContext, ScrapedPost } from './types';
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
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({ accountId, username, verifiedAt: new Date().toISOString() }));

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

        // Extract question links
        const links = await page.$$('a[href]');
        for (const link of links) {
          try {
            const href = await link.getAttribute('href');
            if (!href) continue;
            // Quora questions start with capital letter
            if (!/^\/[A-Z][^/]*\/?$/.test(href)) continue;
            if (href.includes('/profile/') || href.includes('/topic/') || href.includes('/search')) continue;

            const questionUrl = `https://www.quora.com${href}`;
            if (seen.has(questionUrl)) continue;
            seen.add(questionUrl);

            const text = (await link.textContent())?.trim() || '';
            if (!text) continue;

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
