import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import mongoose from 'mongoose';

const WORKSPACE_ID = '69a287760ed5aedec5aabcca';
const PROFILE_DIR = join('/var/www/ai-bot/serpbays-saas/profiles', WORKSPACE_ID, 'quora');

const cookies = [
  {"domain":".quora.com","name":"m-b_lax","value":"QjA2CxQZPs8_4vjcynQpXw==","httpOnly":true,"secure":true,"sameSite":"Lax","path":"/","expires":1806824443},
  {"domain":".quora.com","name":"__gpi","value":"UID=000012084585ce69:T=1771825327:RT=1772263159:S=ALNI_Mb7amUp8UUZxYbbuEagrqXX9-7gdA","path":"/","sameSite":"None","secure":true,"expires":1805521327},
  {"domain":".quora.com","name":"__eoi","value":"ID=6320750c5dd21b03:T=1771825327:RT=1772263159:S=AA-AfjbMtxzewOUfUTozQuxWscvu","path":"/","sameSite":"None","secure":true,"expires":1787377327},
  {"domain":".quora.com","name":"m-s","value":"5peCPNNUNQ8f8HuhIfkY2w==","httpOnly":true,"secure":true,"sameSite":"Lax","path":"/","expires":1806824443},
  {"domain":".quora.com","name":"m-b_strict","value":"QjA2CxQZPs8_4vjcynQpXw==","httpOnly":true,"secure":true,"sameSite":"Strict","path":"/","expires":1806824443},
  {"domain":".quora.com","name":"m-b","value":"QjA2CxQZPs8_4vjcynQpXw==","httpOnly":true,"secure":true,"sameSite":"None","path":"/","expires":1806824443},
  {"domain":".quora.com","name":"__gads","value":"ID=7b0654970e6c9e2b:T=1771825327:RT=1772263159:S=ALNI_MZFUv8me0xOhTkcS_Qs-XvwvHnMcQ","path":"/","sameSite":"None","secure":true,"expires":1805521327},
];

const cookieMap = {};
cookies.forEach(c => cookieMap[c.name] = c.value);

// Step 1: Verify cookies
console.log('Step 1: Verifying Quora cookies...');
mkdirSync(PROFILE_DIR, { recursive: true });
try { unlinkSync(join(PROFILE_DIR, 'SingletonLock')); } catch {}

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 900 },
  locale: 'en-US',
});

await context.addCookies(cookies);
const page = context.pages()[0] || await context.newPage();
await page.goto('https://www.quora.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);

const url = page.url();
console.log('Current URL:', url);

if (url.includes('/login') || url.includes('/register')) {
  console.log('FAIL: Cookies rejected — redirected to login');
  await context.close();
  process.exit(1);
}

const loggedIn = await page.$('[aria-label="Profile"], [aria-label="Your profile"], a[href*="/profile/"], button:has-text("Add question")');
if (!loggedIn) {
  console.log('WARN: No profile indicator found, but not redirected to login. Continuing...');
} else {
  console.log('SUCCESS: Logged in to Quora');
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
console.log('Username:', username || '(not found)');

// Save verified file
const accountId = `qa_${username || 'unknown'}`;
writeFileSync(join(PROFILE_DIR, '.verified'), JSON.stringify({ accountId, username, cookieMap, verifiedAt: new Date().toISOString() }));
console.log('Cookies saved to', PROFILE_DIR);

// Step 2: Scrape with keywords
console.log('\nStep 2: Scraping Quora for keywords...');
const keywords = ['social media automation', 'engagement bot', 'social media marketing'];
const posts = [];
const seen = new Set();

for (const keyword of keywords) {
  try {
    const searchPage = await context.newPage();
    console.log(`  Searching: "${keyword}"`);
    await searchPage.goto(
      `https://www.quora.com/search?q=${encodeURIComponent(keyword)}&type=question&time=day`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await searchPage.waitForTimeout(3000);

    for (let i = 0; i < 2; i++) {
      await searchPage.mouse.wheel(0, 800);
      await searchPage.waitForTimeout(1500);
    }

    const links = await searchPage.$$('a[href]');
    for (const link of links) {
      try {
        const href = await link.getAttribute('href');
        if (!href) continue;
        if (!/^\/[A-Z][^/]*\/?$/.test(href)) continue;
        if (href.includes('/profile/') || href.includes('/topic/') || href.includes('/search')) continue;

        const questionUrl = `https://www.quora.com${href}`;
        if (seen.has(questionUrl)) continue;
        seen.add(questionUrl);

        const text = (await link.textContent())?.trim() || '';
        if (!text) continue;

        posts.push({ url: questionUrl, platform: 'quora', content: text, keyword });
      } catch {}
    }

    await searchPage.close();
  } catch (err) {
    console.log(`  Error searching "${keyword}":`, err.message);
  }
  await new Promise(r => setTimeout(r, 2000));
}

await context.close();

console.log(`\nTotal posts scraped: ${posts.length}`);
posts.forEach((p, i) => {
  console.log(`  ${i + 1}. [${p.keyword}] ${p.content.slice(0, 100)}`);
  console.log(`     ${p.url}`);
});

// Step 3: Save to DB
if (posts.length > 0) {
  console.log('\nStep 3: Saving to MongoDB...');
  await mongoose.connect('mongodb://127.0.0.1:27017/serpbays-saas');

  const postSchema = new mongoose.Schema({}, { strict: false, collection: 'posts' });
  const Post = mongoose.models.Post || mongoose.model('Post', postSchema);

  let saved = 0;
  for (const p of posts) {
    const exists = await Post.findOne({ url: p.url, workspaceId: WORKSPACE_ID });
    if (!exists) {
      await Post.create({
        workspaceId: WORKSPACE_ID,
        url: p.url,
        platform: 'quora',
        author: 'Quora User',
        content: p.content,
        status: 'new',
        scrapedAt: new Date(),
      });
      saved++;
    }
  }
  console.log(`Saved ${saved} new posts to DB (${posts.length - saved} duplicates skipped)`);
  await mongoose.disconnect();
}

console.log('\nDone!');
