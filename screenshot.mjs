import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-web-security'],
  channel: 'chromium'
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
});
const page = await context.newPage();

// Sign in
await page.goto('http://localhost:3006/sign-in', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.fill('input[name="email"], input[type="email"]', 'demo@serpbays.com');
await page.fill('input[name="password"], input[type="password"]', 'demo1234');
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);

if (page.url().includes('dashboard')) {
  // Wait for CSS to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/dashboard-full.png', fullPage: true });
  console.log('Dashboard screenshot saved');

  // Open settings panel
  const settingsBtn = await page.locator('button:has-text("Settings")').first();
  if (await settingsBtn.count() > 0) {
    await settingsBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/settings-panel.png', fullPage: true });
    console.log('Settings panel screenshot saved');
  }
} else {
  console.log('Login failed, URL:', page.url());
  await page.screenshot({ path: '/tmp/dashboard-full.png' });
}

await browser.close();
