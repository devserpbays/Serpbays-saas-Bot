import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:3006/sign-in', { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'demo@serpbays.com');
await page.fill('input[type="password"]', 'demo1234');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard', { timeout: 15000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/ss-dashboard-scheduler.png', fullPage: true });
console.log('Dashboard captured');
if (errors.length) console.log('Errors:', errors.join('\n'));
await browser.close();
