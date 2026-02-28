import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  console.log('\n=== STEP 1: Landing Page ===');
  await page.goto('http://localhost:3006/');
  console.log('  URL:', page.url());
  await page.screenshot({ path: '/tmp/e2e-01-landing.png' });
  console.log('  OK: Landing page loads');

  console.log('\n=== STEP 2: Navigate to Sign In ===');
  await page.click('a[href="/sign-in"]');
  await page.waitForURL('**/sign-in', { timeout: 5000 });
  console.log('  URL:', page.url());
  console.log('  OK: Sign-in page');

  console.log('\n=== STEP 3: Login ===');
  await page.getByLabel('Email').fill('botacc83@gmail.com');
  await page.getByLabel('Password').fill('12345678');
  await page.getByRole('button', { name: 'Sign In' }).click();

  try {
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('  URL:', page.url());
    console.log('  OK: Logged in, redirected to dashboard');
  } catch {
    console.log('  CURRENT URL:', page.url());
    await page.screenshot({ path: '/tmp/e2e-03-login-failed.png' });
    // Try to check for error messages
    const alertText = await page.locator('[role="alert"]').textContent().catch(() => '');
    console.log('  Alert text:', alertText);
    console.log('  FAIL: Login did not redirect to dashboard');
    await browser.close();
    process.exit(1);
  }

  await page.screenshot({ path: '/tmp/e2e-03-dashboard.png' });

  console.log('\n=== STEP 4: Check Dashboard Elements ===');
  const startJobBtn = page.getByRole('button', { name: /Start Job/i });
  const scrapeBtn = page.getByRole('button', { name: /Scrape Only/i });
  const evalBtn = page.getByRole('button', { name: /Evaluate Only/i });
  const scheduleBtn = page.getByRole('button', { name: /Auto-Schedule|Stop Scheduler/i });
  const settingsBtn = page.getByRole('button', { name: /Settings/i });
  const logoutBtn = page.locator('button').filter({ has: page.locator('svg.lucide-log-out') });

  console.log('  Start Job button:', await startJobBtn.count() > 0 ? 'FOUND' : 'NOT FOUND');
  console.log('  Scrape Only button:', await scrapeBtn.count() > 0 ? 'FOUND' : 'NOT FOUND');
  console.log('  Evaluate Only button:', await evalBtn.count() > 0 ? 'FOUND' : 'NOT FOUND');
  console.log('  Auto-Schedule button:', await scheduleBtn.count() > 0 ? 'FOUND' : 'NOT FOUND');
  console.log('  Settings button:', await settingsBtn.count() > 0 ? 'FOUND' : 'NOT FOUND');
  console.log('  Logout button:', await logoutBtn.count() > 0 ? 'FOUND' : 'NOT FOUND');

  console.log('\n=== STEP 5: Test API endpoints (via cookies) ===');

  // Extract cookies for API calls
  const cookies = await ctx.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  // Test stats API
  const statsRes = await page.evaluate(async () => {
    const r = await fetch('/api/stats');
    return { status: r.status, data: await r.json() };
  });
  console.log('  /api/stats:', statsRes.status, '- total posts:', statsRes.data.total);

  // Test settings API
  const settingsRes = await page.evaluate(async () => {
    const r = await fetch('/api/settings');
    return { status: r.status, data: await r.json() };
  });
  console.log('  /api/settings:', settingsRes.status, '- platforms:', settingsRes.data.settings?.platforms?.join(', ') || 'none');
  console.log('  Company:', settingsRes.data.settings?.companyName || '(not set)');
  console.log('  Keywords:', settingsRes.data.settings?.keywords?.join(', ') || '(none)');

  // Test scheduler API
  const schedRes = await page.evaluate(async () => {
    const r = await fetch('/api/scheduler');
    return { status: r.status, data: await r.json() };
  });
  console.log('  /api/scheduler:', schedRes.status, '- running:', schedRes.data.running);

  // Test cookie health
  const healthRes = await page.evaluate(async () => {
    const r = await fetch('/api/cookie-health');
    return { status: r.status, data: await r.json() };
  });
  console.log('  /api/cookie-health:', healthRes.status, '- accounts:', healthRes.data.accounts?.length || 0);

  console.log('\n=== STEP 6: Test Scrape ===');
  const scrapeRes = await page.evaluate(async () => {
    const r = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return { status: r.status, data: await r.json() };
  });
  console.log('  /api/scrape:', scrapeRes.status);
  console.log('  Result:', JSON.stringify(scrapeRes.data));

  console.log('\n=== STEP 7: Test Evaluate ===');
  const evalRes = await page.evaluate(async () => {
    const r = await fetch('/api/evaluate', { method: 'POST' });
    return { status: r.status, data: await r.json() };
  });
  console.log('  /api/evaluate:', evalRes.status);
  console.log('  Result:', JSON.stringify(evalRes.data));

  console.log('\n=== STEP 8: Test Run Pipeline ===');
  const pipeRes = await page.evaluate(async () => {
    const r = await fetch('/api/run-pipeline', { method: 'POST' });
    return { status: r.status, data: await r.json() };
  });
  console.log('  /api/run-pipeline:', pipeRes.status);
  console.log('  Result:', JSON.stringify(pipeRes.data));

  await page.screenshot({ path: '/tmp/e2e-08-after-pipeline.png' });

  console.log('\n=== STEP 9: Test Scheduler Start ===');
  const startRes = await page.evaluate(async () => {
    const r = await fetch('/api/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    });
    return { status: r.status, data: await r.json() };
  });
  console.log('  Start scheduler:', startRes.status, '- running:', startRes.data.running);
  console.log('  Interval:', Math.round((startRes.data.intervalMs || 0) / 60000), 'min');

  // Stop it after testing
  await page.evaluate(async () => {
    await fetch('/api/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' })
    });
  });
  console.log('  Scheduler stopped after test');

  console.log('\n=== STEP 10: Test Logout ===');
  await logoutBtn.first().click();
  try {
    await page.waitForURL('**/sign-in', { timeout: 10000 });
    console.log('  URL after logout:', page.url());
    console.log('  OK: Logout redirected to /sign-in');
  } catch {
    console.log('  URL after logout:', page.url());
    await page.screenshot({ path: '/tmp/e2e-10-logout-fail.png' });
    console.log('  FAIL: Logout did not redirect');
  }

  await page.screenshot({ path: '/tmp/e2e-10-after-logout.png' });

  // Verify we can't access dashboard anymore
  await page.goto('http://localhost:3006/dashboard');
  await page.waitForTimeout(2000);
  console.log('  After logout, /dashboard goes to:', page.url());

  console.log('\n=== ALL TESTS COMPLETE ===\n');
  await browser.close();
})();
