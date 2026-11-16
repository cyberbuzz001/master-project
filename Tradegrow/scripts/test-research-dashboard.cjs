const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    const submitted = [];
    let unavailable = false;
    const id = '12345678-1234-1234-1234-123456789abc';
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/v1/admin/research/**', async route => {
      if (unavailable) return route.fulfill({ status: 503, json: { error: 'Research service is not configured' } });
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/instruments')) return route.fulfill({ json: { instruments: [{ token:'NSE_RELIANCE', symbol:'RELIANCE', exchange:'NSE', expiry:null }] } });
      if (pathname.endsWith('/snapshot')) return route.fulfill({ json: { ...snapshot, as_of: new Date().toISOString() } });
      if (request.method() === 'POST') {
        submitted.push({ body: request.postDataJSON(), key: request.headers()['idempotency-key'] });
        return route.fulfill({ status: 202, json: { id } });
      }
      if (new URL(request.url()).pathname.endsWith('/jobs')) return route.fulfill({ json: {
        jobs: submitted.length ? [{ id, symbol: 'RELIANCE', status: 'COMPLETED', created: Date.now()/1000, asset_type: 'stock' }] : [],
        counts: { COMPLETED: submitted.length ? 1 : 0 }
      } });
      return route.fulfill({ json: { id, status: 'COMPLETED', error: null, result: {
        symbol: 'RELIANCE', as_of: new Date().toISOString(), valid_until: Date.now()/1000-1,
        basis: 'stock price', entry_above: '1340.00', stop_loss: '1336.00', target: '1348.00',
        max_quantity_at_stop: 250, reward_risk: '2', notes: ['Stop gaps can exceed the risk budget.'],
        ai_research: { market_report: 'Company research content.' }
      } } });
    });
    await page.route('**/research-fixture', route => route.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>' }));
    await page.goto('http://127.0.0.1:3000/research-fixture');
    await page.addScriptTag({ type: 'module', content: `import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;` });
    await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__);
    await page.addScriptTag({ type: 'module', content: `
      import React from '/node_modules/.vite/deps/react.js';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
      import { ResearchDashboard } from '/src/components/admin/ResearchDashboard.tsx';
      import '/src/index.css';
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ResearchDashboard,{token:'fixture'}));
    ` });
    await page.getByText('Research service online', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Generate research', exact: true }).isDisabled(), true);
    const snapshot = { symbol: 'RELIANCE', token: 'NSE_RELIANCE', source: 'dhan', asset_type: 'stock',
      as_of: new Date().toISOString(), last_price: '1339.70', tick_size: '.05', lot_size: 1,
      risk_budget: '1000', bars: Array.from({ length: 30 }, (_, i) => ({ timestamp: new Date(Date.now()-(31-i)*60000).toISOString(), open: 1300+i, high:1302+i, low:1298+i, close:1301+i, volume:100 })) };
    await page.getByLabel('Find stock or option contract').fill('RELIANCE');
    await page.getByRole('button', { name:'Search instruments', exact:true }).click();
    await page.getByRole('button', { name:/RELIANCE.*Load snapshot/ }).click();
    await page.getByRole('button', { name: 'Generate research', exact: true }).click();
    await page.getByText('EXPIRED LEVELS', { exact: true }).waitFor();
    await page.getByText('Company research content.', { exact: true }).waitFor();
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].body.token, snapshot.token);
    assert.ok(submitted[0].key);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    }
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    assert.equal((await download).suggestedFilename(), `research-${id}.json`);
    unavailable = true;
    await page.getByRole('button', { name: 'Refresh research jobs' }).click();
    await page.getByText('Service unavailable', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Generate research', exact: true }).isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: research snapshot import, submission, report, expiry, export, responsive layout and unavailable service');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
