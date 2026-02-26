import { chromium } from 'playwright';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { VerifyOptions, VerificationResult, ScrapeContext, ScrapedPost } from './types';
import { BROWSER_ARGS, DEFAULT_USER_AGENT, NAVIGATION_TIMEOUT } from './types';

export async function verifyPinterestCookies(opts: VerifyOptions): Promise<VerificationResult> {
  const { cookieList, cookieMap, profileDir } = opts;

  if (!cookieMap['_pinterest_sess']) {
    return { success: false, error: 'Missing required cookie: _pinterest_sess' };
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
    await page.goto('https://www.pinterest.com', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(3000);

    const url = page.url();
    if (url.includes('/login') || url.includes('/auth/')) {
      return { success: false, error: 'Cookies rejected — redirected to login page' };
    }

    // Check for login button (means not logged in)
    const loginBtn = await page.$('[data-test-id="login-button"], a[href*="/login/"]');
    if (loginBtn) {
      const visible = await loginBtn.isVisible();
      if (visible) {
        return { success: false, error: 'Not logged in — login button visible' };
      }
    }

    // Extract username from avatar/profile link
    let username = '';
    try {
      const avatarLink = await page.$('[data-test-id="header-avatar"], [data-test-id="header-profile-link"]');
      if (avatarLink) {
        const href = await avatarLink.getAttribute('href');
        if (href) {
          const match = href.match(/\/([^/?]+)\/?$/);
          if (match) username = match[1];
        }
      }
    } catch {}

    const accountId = `pt_${username || 'unknown'}`;
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({ accountId, username, verifiedAt: new Date().toISOString() }));

    return { success: true, username, displayName: username, accountId, profileDir };
  } catch (err) {
    return { success: false, error: `Verification failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}

export async function scrapePinterest(ctx: ScrapeContext): Promise<ScrapedPost[]> {
  const { keywords, cookieMap } = ctx;
  const posts: ScrapedPost[] = [];

  if (!cookieMap['_pinterest_sess']) return posts;

  const seen = new Set<string>();

  for (const keyword of keywords) {
    try {
      const csrfToken = cookieMap['csrftoken'] || '';
      const params = new URLSearchParams({
        source_url: `/search/pins/?q=${encodeURIComponent(keyword)}&rs=typed`,
        data: JSON.stringify({
          options: {
            query: keyword,
            scope: 'pins',
            page_size: 25,
          },
          context: {},
        }),
      });

      const res = await fetch(
        `https://www.pinterest.com/resource/BaseSearchResource/get/?${params}`,
        {
          headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            'X-CSRFToken': csrfToken,
            Cookie: `_pinterest_sess=${cookieMap['_pinterest_sess']}; csrftoken=${csrfToken}`,
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
          },
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const results = data?.resource_response?.data?.results || [];

      for (const pin of results) {
        const pinId = pin.id;
        if (!pinId) continue;
        const pinUrl = `https://www.pinterest.com/pin/${pinId}/`;
        if (seen.has(pinUrl)) continue;
        seen.add(pinUrl);

        const description = pin.description || pin.grid_title || pin.title || '';
        if (!description) continue;

        posts.push({
          url: pinUrl,
          platform: 'pinterest',
          author: pin.pinner?.username || pin.pinner?.full_name || 'Unknown',
          content: description,
          scrapedAt: new Date(),
          likeCount: pin.repin_count || 0,
          replyCount: pin.comment_count || 0,
        });
      }
    } catch {}

    await new Promise((r) => setTimeout(r, 2000));
  }

  return posts;
}
