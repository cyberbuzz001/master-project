// Frontend smoke check with isolated API fixtures. Never contacts production.
// Run with a Vite server on port 3000 and Playwright available in NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mobile-layout-test');
      localStorage.setItem('onboarding_dismissed_test', 'true');
      localStorage.setItem('user_theme', 'dark');
    });
    await page.route('**/api/**', async route => {
      const url = route.request().url();
      const json = url.includes('/auth/me') ? { success: true, user: { id: 'test', username: 'Nikhil', fullName: 'Nikhil Test', role: 'USER', isKycCompleted: true } }
        : url.includes('/wallet') ? { success: true, wallet: { cashBalance: 10000, buyingPower: 10000, usedMargin: 0, realizedPnl: 0, unrealizedPnl: 0 } }
        : url.includes('/quote/') ? { success: true, tick: { instrumentToken: url.split('/').pop(), ltp: 24510.25, change: 123.5, changePercent: .51, timestamp: Date.now() } }
        : { success: true, data: [], messages: [], notifications: [], positions: [], orders: [], holdings: [], instruments: [] };
      await route.fulfill({ json });
    });
    await page.goto('http://127.0.0.1:3000');
    const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await nav.waitFor();
    await page.getByText('No market movers available.', { exact: true }).waitFor();
    assert.equal(await page.getByText('₹142.50', { exact: true }).count(), 0, 'empty APIs must not insert fallback contract prices');
    assert.equal(await page.locator('.tg-mobile-header').isVisible(), true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.evaluate(() => window.scrollTo(0, 350));
    await page.waitForTimeout(100);
    assert.ok(Math.abs((await page.locator('.tg-mobile-header').boundingBox()).y) <= 1, 'mobile header remains sticky');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Indices', exact: true }).click();
    assert.equal(await page.locator('#tg-mobile-indices').isVisible(), true);
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(5600);
    assert.equal(await page.locator('.tg-glass-nav').getAttribute('aria-hidden'), 'true');
    await page.touchscreen.tap(20, 210);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.tg-glass-nav').getAttribute('aria-hidden'), 'false');
    await page.getByRole('button', { name: 'Open trading tools' }).click();
    await page.waitForTimeout(5600);
    assert.equal(await page.locator('.tg-glass-nav').getAttribute('aria-hidden'), 'false');
    await page.getByRole('button', { name: 'Close more menu' }).click();
    await page.locator('.tg-mobile-header button[aria-label^="Notifications"]').click();
    await page.waitForTimeout(5600);
    assert.equal(await page.locator('.tg-glass-nav').getAttribute('aria-hidden'), 'false');
    await page.locator('.tg-mobile-header button[aria-label^="Notifications"]').click();
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'keyboard-pinning-probe'; document.body.append(input); input.focus();
    });
    await page.waitForTimeout(5600);
    assert.equal(await page.locator('.tg-glass-nav').getAttribute('aria-hidden'), 'false');
    await page.evaluate(() => document.getElementById('keyboard-pinning-probe').remove());
    await page.getByRole('button', { name: 'Orders', exact: true }).click();
    await page.waitForURL('**/portfolio/orders');
    await page.waitForFunction(() => document.querySelector('.tg-glass-nav a[href="/portfolio/positions"]')?.getAttribute('aria-current') === 'page');
    assert.equal(await page.getByRole('link', { name: 'Portfolio', exact: true }).getAttribute('aria-current'), 'page');
    const support = await page.locator('.tg-support-position').boundingBox();
    const capsule = await page.locator('.tg-glass-nav').boundingBox();
    assert.ok(support && capsule && support.y + support.height <= capsule.y);
    const install = await page.locator('.tg-install-position').count() ? await page.locator('.tg-install-position').boundingBox() : null;
    if (install) assert.ok(install.y + install.height <= support.y);
    await page.setViewportSize({ width: 320, height: 740 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: '/tmp/tradegrow-mobile.png' });
    // A slow NIFTY response must not overwrite SENSEX after switching indices.
    await page.route('**/api/v1/market/option-chain?*', async route => {
      const symbol = new URL(route.request().url()).searchParams.get('symbol');
      if (symbol === 'NIFTY') await new Promise(resolve => setTimeout(resolve, 900));
      await route.fulfill({ json: { success: true, chain: [], spotPrice: symbol === 'NIFTY' ? 11111 : 22222 } }).catch(() => {});
    });
    const oldRequest = page.waitForRequest(request => request.url().includes('/market/option-chain?') && request.url().includes('symbol=NIFTY'));
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await oldRequest;
    await page.getByRole('button').filter({ hasText: 'BSE SENSEX' }).click();
    await page.getByRole('button').filter({ hasText: 'BSE SENSEX' }).getByText('₹22,222.00', { exact: true }).waitFor();
    await page.waitForTimeout(1200);
    assert.equal(await page.getByRole('button').filter({ hasText: 'BSE SENSEX' }).getByText('₹22,222.00', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Unavailable', { exact: true }).count(), 1, 'missing OI must not imply Neutral sentiment');
    await page.getByRole('link', { name: 'Watchlist', exact: true }).click();
    const search = page.getByRole('textbox', { name: 'Search instruments to add to watchlist' });
    await search.waitFor();
    assert.ok((await search.boundingBox()).height >= 44);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    console.log('PASS: header, indices, idle hide, touch wake, sheet/notification/input pinning, route sync, support/install clearance, 320px layout');
    console.log('PASS: late option response isolation, unavailable sentiment, Watchlist search tap target');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
