import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:3006/sign-in');
  await page.getByLabel('Email').fill('botacc83@gmail.com');
  await page.getByLabel('Password').fill('12345678');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  
  // Open settings
  await page.getByRole('button', { name: /Settings/i }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/settings-general.png' });
  
  // Click Platforms tab
  await page.getByRole('tab', { name: 'Platforms' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/settings-platforms.png' });
  
  await browser.close();
})();
