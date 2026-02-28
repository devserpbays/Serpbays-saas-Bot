import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Listen to console messages
  page.on('console', msg => console.log('  BROWSER:', msg.type(), msg.text()));

  // Listen to network
  page.on('response', res => {
    if (res.url().includes('/api/auth')) {
      console.log('  NETWORK:', res.status(), res.url());
    }
  });

  await page.goto('http://localhost:3006/sign-in');
  await page.waitForLoadState('networkidle');
  console.log('Sign-in page loaded');

  await page.getByLabel('Email').fill('botacc83@gmail.com');
  await page.getByLabel('Password').fill('12345678');

  console.log('Clicking Sign In...');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait a bit for network
  await page.waitForTimeout(5000);
  console.log('Current URL:', page.url());

  // Check for any error messages
  const alerts = await page.locator('[role="alert"]').all();
  for (const alert of alerts) {
    console.log('Alert:', await alert.textContent());
  }

  // Check what's visible
  const bodyText = await page.locator('body').textContent();
  if (bodyText.includes('Invalid')) {
    console.log('ERROR: Invalid credentials');
  }

  await page.screenshot({ path: '/tmp/e2e-login-debug.png' });

  // Try direct API call to test credentials
  console.log('\nTesting credentials via API...');
  const signInRes = await page.evaluate(async () => {
    const res = await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email: 'botacc83@gmail.com',
        password: '12345678',
        redirect: 'false',
        csrfToken: document.querySelector('input[name="csrfToken"]')?.value || '',
        callbackUrl: 'http://localhost:3006/dashboard',
        json: 'true',
      }),
      redirect: 'manual',
    });
    return { status: res.status, url: res.url, type: res.type };
  });
  console.log('Direct API result:', JSON.stringify(signInRes));

  await browser.close();
})();
