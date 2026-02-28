import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:3006/sign-in');
  await page.getByLabel('Email').fill('botacc83@gmail.com');
  await page.getByLabel('Password').fill('12345678');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  
  // Open settings > Platforms tab
  await page.getByRole('button', { name: /Settings/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole('tab', { name: 'Platforms' }).click();
  await page.waitForTimeout(300);
  
  // Click "Connect Account" on Reddit
  const connectBtns = page.getByRole('button', { name: /Connect Account/i });
  const redditConnect = connectBtns.nth(1); // Reddit is 2nd platform
  await redditConnect.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/settings-connect-form.png' });
  
  await browser.close();
})();
