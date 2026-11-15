const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('token', 'terminal-fixture');
      localStorage.setItem('user_theme', 'light');
      localStorage.setItem('onboarding_dismissed_terminal-test', 'true');
    });
    await page.route('**/api/**', route => {
      const url = route.request().url();
      const now = Math.floor(Date.now() / 60000) * 60;
      const json = url.includes('/auth/me') ? { success: true, user: { id: 'terminal-test', username: 'Trader', role: 'USER', isKycCompleted: true } }
        : url.includes('/wallet') ? { success: true, wallet: { cashBalance: 948845.12, buyingPower: 848845.12, usedMargin: 100000, realizedPnl: 0 } }
        : url.includes('/quote/') ? { success: true, tick: { instrumentToken: url.split('/').pop(), ltp: 1339.7, change: 4, changePercent: .3, timestamp: Date.now() } }
        : { success: true, data: [], instruments: [], positions: [], orders: [], candles: Array.from({ length: 30 }, (_, i) => ({ time: now - (30 - i) * 60, open: 1330 + i / 10, high: 1335 + i / 10, low: 1325 + i / 10, close: 1332 + i / 10, volume: 100 })) };
      return route.fulfill({ json });
    });
    await page.goto('http://127.0.0.1:3000/terminal?symbol=RELIANCE&token=NSE_RELIANCE');
    await page.getByRole('heading', { name: 'RELIANCE', exact: true }).waitFor();
    await page.getByText('₹8,48,845.12', { exact: true }).waitFor();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole('button', { name: 'Fit chart to data' }).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      const terminal = await page.locator('.tg-terminal').boundingBox();
      const footer = await page.locator('.tg-glass-nav').boundingBox();
      assert.ok(terminal.y + terminal.height <= footer.y, 'terminal clears floating navigation');
      assert.equal(await page.getByRole('button', { name: 'Open support chat', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'BUY', exact: true }).count(), 1);
      assert.equal(await page.locator('.tg-terminal').evaluate(el => getComputedStyle(el).getPropertyValue('--bg-surface').trim()), '#111622');
      assert.equal(await page.getByRole('heading', { name: 'RELIANCE', exact: true }).evaluate(el => getComputedStyle(el).color), 'rgb(241, 245, 249)', 'terminal heading stays legible under the site light theme');
    }
    await page.screenshot({ path: '/tmp/tradegrow-terminal-redesign.png' });
    await page.getByRole('button', { name: 'BUY', exact: true }).click();
    assert.equal(await page.getByRole('tab', { name: 'Order Pad', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', { name: 'Chart', exact: true }).click();
    await page.getByRole('button', { name: 'Fit chart to data' }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: terminal 320/390px layout, dark consistency, margin accuracy, single action bar, footer clearance, chart/order-pad switching');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
