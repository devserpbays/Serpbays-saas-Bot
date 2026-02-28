import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3006/');
  console.log('1. Landing page:', page.url());
  
  await page.click('a[href="/sign-in"]');
  await page.waitForURL('**/sign-in');
  console.log('2. Sign-in page:', page.url());

  await page.getByLabel('Email').fill('botacc83@gmail.com');
  await page.getByLabel('Password').fill('12345678');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('3. Dashboard:', page.url());
  await page.screenshot({ path: '/tmp/test-dashboard-loggedin.png' });

  const logoutBtn = page.locator('button').filter({ has: page.locator('svg.lucide-log-out') });
  const logoutCount = await logoutBtn.count();
  console.log('4. Logout buttons found:', logoutCount);

  if (logoutCount > 0) {
    await logoutBtn.first().click();
    try {
      await page.waitForURL('**/sign-in', { timeout: 10000 });
      console.log('5. After logout:', page.url());
      await page.screenshot({ path: '/tmp/test-after-logout.png' });
      console.log('SUCCESS: Logout redirected to /sign-in');
    } catch (e) {
      console.log('5. After logout (timeout):', page.url());
      await page.screenshot({ path: '/tmp/test-after-logout.png' });
      console.log('ISSUE: Did not redirect to /sign-in');
    }
  } else {
    console.log('Could not find logout button');
  }

  await browser.close();
})();
