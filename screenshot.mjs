import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));

// Login
await page.goto('http://localhost:3006/sign-in', { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'demo@serpbays.com');
await page.fill('input[type="password"]', 'demo1234');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard', { timeout: 15000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);

// Dashboard screenshot
await page.screenshot({ path: '/tmp/ss-dashboard.png', fullPage: true });
console.log('1. Dashboard captured');

// Open Settings
await page.click('button:has-text("Settings")');
await page.waitForTimeout(1500);

// General tab screenshot
await page.screenshot({ path: '/tmp/ss-settings-general.png', fullPage: true });
console.log('2. Settings General captured');

// Platforms tab
await page.click('button:has-text("Platforms")');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/ss-settings-platforms.png', fullPage: true });
console.log('3. Settings Platforms captured');

// Advanced tab
await page.click('button:has-text("Advanced")');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/ss-settings-advanced.png', fullPage: true });
console.log('4. Settings Advanced captured');

if (errors.length) console.log('Errors:', errors.join('\n'));
await browser.close();
