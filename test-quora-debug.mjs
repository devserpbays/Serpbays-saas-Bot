import { chromium } from 'playwright';
import { mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

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
const page = context.pages()[0] || await context.newPage();

// Search for a keyword
const keyword = 'social media marketing';
const searchUrl = `https://www.quora.com/search?q=${encodeURIComponent(keyword)}&type=question&time=day`;
console.log('Navigating to:', searchUrl);
await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);

console.log('Current URL:', page.url());
await page.screenshot({ path: '/tmp/quora-search-1.png', fullPage: false });

// Scroll down
for (let i = 0; i < 3; i++) {
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(2000);
}
await page.screenshot({ path: '/tmp/quora-search-2.png', fullPage: false });

// Debug: print all links
const allLinks = await page.$$eval('a[href]', els => els.map(e => ({
  href: e.getAttribute('href'),
  text: (e.textContent || '').trim().slice(0, 80)
})));
console.log(`\nTotal links on page: ${allLinks.length}`);

// Filter for question-like links
const questionLinks = allLinks.filter(l => {
  if (!l.href) return false;
  if (l.href.startsWith('/') && /^\/[A-Z]/.test(l.href) && !l.href.includes('/profile/') && !l.href.includes('/topic/') && !l.href.includes('/search')) return true;
  return false;
});
console.log(`Question-like links: ${questionLinks.length}`);
questionLinks.forEach(l => console.log(`  ${l.href} -> ${l.text}`));

// Also check all links for question patterns (broader match)
const anyQuestionLinks = allLinks.filter(l => l.href && (l.href.includes('quora.com/') || l.href.startsWith('/')) && l.text.length > 20);
console.log(`\nLinks with long text: ${anyQuestionLinks.length}`);
anyQuestionLinks.slice(0, 20).forEach(l => console.log(`  ${l.href} -> ${l.text}`));

// Try without time filter
console.log('\n--- Trying without time filter ---');
await page.goto(`https://www.quora.com/search?q=${encodeURIComponent(keyword)}&type=question`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: '/tmp/quora-search-3.png', fullPage: false });

const links2 = await page.$$eval('a[href]', els => els.map(e => ({
  href: e.getAttribute('href'),
  text: (e.textContent || '').trim().slice(0, 80)
})));
const qLinks2 = links2.filter(l => l.href && l.href.startsWith('/') && /^\/[A-Z]/.test(l.href) && !l.href.includes('/profile/') && !l.href.includes('/topic/'));
console.log(`Question links (no time filter): ${qLinks2.length}`);
qLinks2.slice(0, 10).forEach(l => console.log(`  ${l.href} -> ${l.text}`));

// Broader pattern check
const broader = links2.filter(l => l.href && l.text.length > 15 && !l.href.includes('/profile/') && !l.href.includes('/search') && !l.href.includes('/topic/'));
console.log(`\nBroader match links: ${broader.length}`);
broader.slice(0, 20).forEach(l => console.log(`  ${l.href} -> ${l.text}`));

await context.close();
console.log('\nScreenshots saved to /tmp/quora-search-*.png');
