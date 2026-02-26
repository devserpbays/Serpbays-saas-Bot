import { chromium } from 'playwright';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { VerifyOptions, VerificationResult, ScrapeContext, ScrapedPost } from './types';
import { BROWSER_ARGS, DEFAULT_USER_AGENT, NAVIGATION_TIMEOUT } from './types';

export async function verifyYoutubeCookies(opts: VerifyOptions): Promise<VerificationResult> {
  const { cookieList, cookieMap, profileDir } = opts;

  const hasGoogleCookies = cookieMap['SID'] || cookieMap['HSID'] || cookieMap['SSID'];
  if (!hasGoogleCookies) {
    return { success: false, error: 'Missing required Google cookies: SID, HSID, or SSID' };
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
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(4000);

    const url = page.url();
    if (url.includes('accounts.google.com') || url.includes('/signin')) {
      return { success: false, error: 'Cookies rejected — redirected to Google sign-in' };
    }

    // Check for sign-in button (means not logged in)
    const signInBtn = await page.$('a[href*="accounts.google.com/ServiceLogin"], ytd-button-renderer a[href*="accounts.google.com"]');
    if (signInBtn) {
      const visible = await signInBtn.isVisible();
      if (visible) {
        return { success: false, error: 'Not logged in — Sign In button visible' };
      }
    }

    // Extract username
    let username = '';
    let displayName = '';
    try {
      const avatarBtn = await page.$('#avatar-btn, button[aria-label*="Account"]');
      if (avatarBtn) {
        await avatarBtn.click();
        await page.waitForTimeout(1500);

        const channelLink = await page.$('a[href*="/@"], a[href*="/channel/"]');
        if (channelLink) {
          const href = await channelLink.getAttribute('href');
          if (href) {
            const match = href.match(/\/@([^/?]+)/);
            if (match) username = match[1];
          }
        }

        const nameEl = await page.$('#account-name, yt-formatted-string#account-name');
        if (nameEl) {
          displayName = (await nameEl.textContent())?.trim() || '';
        }
      }
    } catch {}

    const accountId = `yt_${username || 'unknown'}`;
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({ accountId, username, displayName, verifiedAt: new Date().toISOString() }));

    return { success: true, username, displayName, accountId, profileDir };
  } catch (err) {
    return { success: false, error: `Verification failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}

export async function scrapeYoutube(ctx: ScrapeContext): Promise<ScrapedPost[]> {
  const { keywords } = ctx;
  const posts: ScrapedPost[] = [];
  const seen = new Set<string>();

  // Try YouTube Data API v3 if key available
  const apiKey = process.env.YOUTUBE_API_KEY;

  for (const keyword of keywords) {
    if (apiKey) {
      try {
        const params = new URLSearchParams({
          part: 'snippet',
          q: keyword,
          type: 'video',
          order: 'date',
          maxResults: '20',
          key: apiKey,
        });
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          for (const item of data.items || []) {
            const videoId = item.id?.videoId;
            if (!videoId) continue;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            if (seen.has(videoUrl)) continue;
            seen.add(videoUrl);

            posts.push({
              url: videoUrl,
              platform: 'youtube',
              author: item.snippet?.channelTitle || 'Unknown',
              content: `${item.snippet?.title || ''}\n\n${item.snippet?.description || ''}`.trim(),
              scrapedAt: new Date(item.snippet?.publishedAt || Date.now()),
            });
          }
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
      } catch {}
    }

    // Fallback: innertube API
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': DEFAULT_USER_AGENT },
        body: JSON.stringify({
          context: {
            client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' },
          },
          query: keyword,
        }),
      });
      if (!res.ok) continue;

      const data = await res.json();
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
      for (const section of contents) {
        const items = section?.itemSectionRenderer?.contents || [];
        for (const item of items) {
          const video = item?.videoRenderer;
          if (!video?.videoId) continue;
          const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
          if (seen.has(videoUrl)) continue;
          seen.add(videoUrl);

          const title = video.title?.runs?.map((r: { text: string }) => r.text).join('') || '';
          const desc = video.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: { text: string }) => r.text).join('') || '';

          posts.push({
            url: videoUrl,
            platform: 'youtube',
            author: video.ownerText?.runs?.[0]?.text || 'Unknown',
            content: `${title}\n\n${desc}`.trim(),
            scrapedAt: new Date(),
            viewCount: parseInt(video.viewCountText?.simpleText?.replace(/[^0-9]/g, '') || '0') || 0,
          });
        }
      }
    } catch {}

    await new Promise((r) => setTimeout(r, 1000));
  }

  return posts;
}
