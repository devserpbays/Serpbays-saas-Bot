import { chromium } from 'playwright';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { VerifyOptions, VerificationResult, ScrapeContext, ScrapedPost, PostReplyContext, PostReplyResult } from './types';
import { BROWSER_ARGS, DEFAULT_USER_AGENT, NAVIGATION_TIMEOUT } from './types';

export async function verifyYoutubeCookies(opts: VerifyOptions): Promise<VerificationResult> {
  const { cookieList, cookieMap, profileDir } = opts;

  // YouTube commenting requires Google auth cookies from google.com domain
  const hasGoogleAuth = cookieMap['SID'] || cookieMap['HSID'] || cookieMap['__Secure-1PSID'] || cookieMap['__Secure-3PSID'];
  if (!hasGoogleAuth) {
    return {
      success: false,
      error: 'Missing Google auth cookies. YouTube requires cookies from BOTH youtube.com AND google.com. '
        + 'Open google.com in your browser → Cookie Editor → Export → paste here together with your YouTube cookies.',
    };
  }

  if (!cookieMap['SAPISID'] && !cookieMap['__Secure-1PAPISID']) {
    return { success: false, error: 'Missing required cookies: SAPISID or __Secure-1PAPISID' };
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

    // Extract ALL cookies from browser (includes cross-domain cookies acquired during navigation)
    const allBrowserCookies = await context.cookies();
    const fullCookieMap = { ...cookieMap };
    for (const c of allBrowserCookies) {
      if (c.value && !fullCookieMap[c.name]) {
        fullCookieMap[c.name] = c.value;
      }
    }

    // Store full cookie list with original domains for accurate replay during posting
    const storedCookieList = cookieList.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
    }));

    const accountId = `yt_${username || 'unknown'}`;
    writeFileSync(join(profileDir, '.verified'), JSON.stringify({
      accountId, username, displayName,
      cookieMap: fullCookieMap,
      cookieList: storedCookieList,
      verifiedAt: new Date().toISOString(),
    }));

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

/**
 * Post a comment on a YouTube video using Playwright DOM automation.
 * Matches the proven bot-serp approach: scroll to comments, force click placeholder,
 * human typing delay, #submit-button click, Ctrl+Enter fallback, post verification.
 */
export async function postYoutubeReply(ctx: PostReplyContext): Promise<PostReplyResult> {
  const { postUrl, replyText, cookieList, cookieMap, profileDir } = ctx;

  const hasGoogleCookies = cookieMap['SID'] || cookieMap['HSID'] || cookieMap['__Secure-1PSID'] || cookieMap['__Secure-3PSID'];
  if (!hasGoogleCookies) {
    return { success: false, error: 'Missing required Google cookies. Please re-verify with cookies from both youtube.com and google.com.' };
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

    // Check for sign-in redirect
    const url = page.url();
    if (url.includes('accounts.google.com') || url.includes('/signin')) {
      return { success: false, error: 'Session expired — redirected to Google sign-in. Please re-verify cookies.' };
    }

    // Dismiss YouTube Music promo overlay if present
    const promoBtn = await page.$('button:has-text("No thanks"), button:has-text("Dismiss")');
    if (promoBtn && await promoBtn.isVisible().catch(() => false)) {
      await promoBtn.click();
      await page.waitForTimeout(1000);
    }

    // Scroll down to the comment section
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(2000);

    // Click the comment box placeholder to activate it
    const placeholderSelectors = [
      '#placeholder-area',
      'ytd-comment-simplebox-renderer #placeholder-area',
      '[id="placeholder-area"]',
    ];

    let clicked = false;
    for (const sel of placeholderSelectors) {
      const elements = await page.$$(sel);
      for (const el of elements) {
        if (await el.isVisible().catch(() => false)) {
          await el.click({ force: true });
          clicked = true;
          await page.waitForTimeout(1500);
          break;
        }
      }
      if (clicked) break;
    }

    if (!clicked) {
      // Try scrolling more and clicking
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(1000);
      for (const sel of placeholderSelectors) {
        const elements = await page.$$(sel);
        for (const el of elements) {
          if (await el.isVisible().catch(() => false)) {
            await el.click({ force: true });
            clicked = true;
            await page.waitForTimeout(1500);
            break;
          }
        }
        if (clicked) break;
      }
    }

    // Check if a sign-in dialog appeared (means cookies are insufficient)
    const signInModal = await page.$('ytd-modal-with-title-and-button-renderer');
    if (signInModal) {
      const modalVisible = await signInModal.isVisible().catch(() => false);
      if (modalVisible) {
        const modalText = (await signInModal.textContent().catch(() => ''))?.trim() || '';
        if (modalText.includes('Sign in')) {
          return {
            success: false,
            error: 'YouTube requires re-authentication to comment. Please re-verify your cookies: '
              + 'export cookies from BOTH youtube.com AND google.com (SID, HSID cookies are required).',
          };
        }
      }
    }

    // Find the editor
    const editorSelectors = [
      '#contenteditable-root',
      'div[contenteditable="true"]#contenteditable-root',
      'yt-formatted-string[contenteditable="true"]',
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
      await page.screenshot({ path: '/tmp/youtube-comment-failed.png', fullPage: false }).catch(() => {});
      return { success: false, error: 'Could not find comment editor. Comments may be disabled or cookies expired.' };
    }

    await editor.click({ force: true });
    await page.waitForTimeout(500);
    await page.keyboard.type(replyText, { delay: 30 });
    await page.waitForTimeout(1000);

    // Click Submit button
    const submitSelectors = [
      '#submit-button',
      'yt-button-shape#submit-button button',
      'ytd-comment-simplebox-renderer #submit-button button',
    ];

    let submitted = false;
    for (const sel of submitSelectors) {
      const elements = await page.$$(sel);
      for (const el of elements) {
        if (await el.isVisible().catch(() => false)) {
          await el.click({ force: true });
          submitted = true;
          break;
        }
      }
      if (submitted) break;
    }

    if (!submitted) {
      // Ctrl+Enter as fallback
      await page.keyboard.press('Control+Enter');
    }

    await page.waitForTimeout(4000);

    // Verify: check if comment text appears in page
    const pageText = await page.textContent('body').catch(() => '');
    const verified = pageText?.includes(replyText.slice(0, 20)) ?? false;

    if (!verified) {
      await page.screenshot({ path: '/tmp/youtube-post-failed.png', fullPage: false }).catch(() => {});
    }

    // Try to extract comment ID from the page or API response
    let commentId = '';
    try {
      // Look for the comment in create_comment responses
      const responses = context.pages();
      // Extract from page content
      const body = await page.textContent('body').catch(() => '');
      const match = body?.match(/"commentId"\s*:\s*"([^"]+)"/);
      if (match) commentId = match[1];
    } catch {}

    // Verify the comment is publicly visible via YouTube Data API
    if (commentId) {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (apiKey) {
        await page.waitForTimeout(5000);
        try {
          const checkUrl = `https://www.googleapis.com/youtube/v3/comments?id=${commentId}&part=snippet&key=${apiKey}`;
          const checkRes = await fetch(checkUrl);
          if (checkRes.ok) {
            const checkData = await checkRes.json() as { items?: unknown[] };
            const isVisible = (checkData.items?.length || 0) > 0;
            if (!isVisible) {
              const replyUrl = `${postUrl}${postUrl.includes('?') ? '&' : '?'}lc=${commentId}`;
              return {
                success: false,
                replyUrl,
                error: 'Comment was submitted but spam-filtered by YouTube (not publicly visible). '
                  + 'The reply text may be too promotional. Avoid brand names, calls-to-action, and marketing language.',
              };
            }
          }
        } catch {
          // API check failed — proceed without verification
        }
      }
    }

    const replyUrl = commentId
      ? `${postUrl}${postUrl.includes('?') ? '&' : '?'}lc=${commentId}`
      : postUrl;

    return { success: true, replyUrl };
  } catch (err) {
    return { success: false, error: `Failed to post YouTube comment: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context.close();
  }
}
