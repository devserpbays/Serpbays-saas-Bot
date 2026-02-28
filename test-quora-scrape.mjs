import { chromium } from 'playwright';
import { mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import mongoose from 'mongoose';

const WORKSPACE_ID = '69a287760ed5aedec5aabcca';
const PROFILE_DIR = join('/var/www/ai-bot/serpbays-saas/profiles', WORKSPACE_ID, 'quora');

const cookies = [
  {"domain":".quora.com","name":"m-b_lax","value":"QjA2CxQZPs8_4vjcynQpXw==","httpOnly":true,"secure":true,"sameSite":"Lax","path":"/","expires":1806824443},
  {"domain":".quora.com","name":"m-s","value":"5peCPNNUNQ8f8HuhIfkY2w==","httpOnly":true,"secure":true,"sameSite":"Lax","path":"/","expires":1806824443},
  {"domain":".quora.com","name":"m-b_strict","value":"QjA2CxQZPs8_4vjcynQpXw==","httpOnly":true,"secure":true,"sameSite":"Strict","path":"/","expires":1806824443},
  {"domain":".quora.com","name":"m-b","value":"QjA2CxQZPs8_4vjcynQpXw==","httpOnly":true,"secure":true,"sameSite":"None","path":"/","expires":1806824443},
];

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
const keywords = ['social media automation', 'engagement bot', 'social media marketing'];
const posts = [];
const seen = new Set();

for (const keyword of keywords) {
  try {
    const page = await context.newPage();
    console.log(`Searching: "${keyword}"`);
    await page.goto(
      `https://www.quora.com/search?q=${encodeURIComponent(keyword)}&type=question`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await page.waitForTimeout(4000);

    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(1500);
    }

    const links = await page.$$('a[href]');
    for (const link of links) {
      try {
        const href = await link.getAttribute('href');
        if (!href) continue;

        let questionUrl = '';
        if (/^\/[A-Z][^/]*\/?$/.test(href)) {
          questionUrl = `https://www.quora.com${href}`;
        } else if (/^https?:\/\/([a-z]+\.)?quora\.com\/[A-Z][^?#]*/.test(href)) {
          questionUrl = href.split('?')[0].split('#')[0];
        }
        if (!questionUrl) continue;
        if (questionUrl.includes('/profile/') || questionUrl.includes('/topic/') || questionUrl.includes('/search')) continue;
        if (questionUrl.includes('/unanswered/')) questionUrl = questionUrl.replace('/unanswered/', '/');

        if (seen.has(questionUrl)) continue;
        seen.add(questionUrl);

        const text = (await link.textContent())?.trim() || '';
        if (!text || text.length < 10) continue;

        posts.push({ url: questionUrl, platform: 'quora', content: text, keyword });
      } catch {}
    }
    await page.close();
  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 2000));
}

await context.close();

console.log(`\nTotal posts scraped: ${posts.length}`);
posts.forEach((p, i) => {
  console.log(`  ${i + 1}. [${p.keyword}] ${p.content.slice(0, 100)}`);
});

if (posts.length > 0) {
  console.log('\nSaving to MongoDB...');
  await mongoose.connect('mongodb://127.0.0.1:27017/serpbays-saas');
  const postSchema = new mongoose.Schema({}, { strict: false, collection: 'posts' });
  const Post = mongoose.models.Post || mongoose.model('Post', postSchema);
  let saved = 0;
  for (const p of posts) {
    const exists = await Post.findOne({ url: p.url, workspaceId: WORKSPACE_ID });
    if (!exists) {
      await Post.create({ workspaceId: WORKSPACE_ID, url: p.url, platform: 'quora', author: 'Quora User', content: p.content, status: 'new', scrapedAt: new Date() });
      saved++;
    }
  }
  console.log(`Saved ${saved} new posts (${posts.length - saved} duplicates skipped)`);
  await mongoose.disconnect();
}
