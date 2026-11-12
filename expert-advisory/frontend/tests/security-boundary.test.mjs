import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:3310';
let app;
let output = '';
const calls = [];
const backend = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  calls.push({ path: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/office' || req.url.startsWith('/office/')) {
    res.writeHead(403); res.end(JSON.stringify({ panel: 'canonical-backend' })); return;
  }
  if (req.url === '/sanctum/csrf-cookie') {
    res.setHeader('Set-Cookie', ['esc_session=csrf-session; HttpOnly; Path=/', 'XSRF-TOKEN=csrf-token; Path=/']);
    res.writeHead(204); res.end(); return;
  }
  if (req.url === '/api/v1/auth/login') {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (body.email === 'valid@example.test' && body.password === ' Valid password! ') {
      res.setHeader('Set-Cookie', ['esc_session=opaque-session; HttpOnly; Path=/', 'XSRF-TOKEN=opaque-xsrf; Path=/']);
      res.end(JSON.stringify({ success: true })); return;
    }
    res.writeHead(401); res.end(JSON.stringify({ success: false, error_code: 'INVALID_CREDENTIALS' })); return;
  }
  if (req.url.startsWith('/api/v1/me') && req.headers.cookie?.split('; ').includes('esc_session=verified-admin')) {
    res.end(JSON.stringify({ success: true, data: { user_type: 'staff', permissions: ['settings.manage'], two_factor: { enabled: true, verified_this_session: true, enrollment_required: false } } })); return;
  }
  if (req.headers.cookie?.split('; ').includes('esc_session=verified-client')) {
    if (req.url === '/api/v1/me') {
      res.end(JSON.stringify({ success: true, data: { id: 'test-client', name: 'Verified client', email: 'client@example.test', user_type: 'client', status: 'active', roles: [{ name: 'client', label: 'Client' }], permissions: ['portal.access'], areas: ['portal'], two_factor: { enabled: false, required: false, enrollment_required: false, verified_this_session: false } } })); return;
    }
    if (req.url === '/api/v1/client/dashboard') {
      res.end(JSON.stringify({ success: true, data: { client: { client_code: 'TEST-CLIENT-1', full_name: 'Verified client', onboarding_status: 'pending', relationship_manager: null }, notices: [] } })); return;
    }
    if (req.url === '/api/v1/client/billing') {
      res.end(JSON.stringify({ success: true, data: { subscriptions: [], invoices: [], payments: [] } })); return;
    }
    if (req.url === '/api/v1/client/research') {
      res.end(JSON.stringify({ success: true, data: { active_subscription: false, reports: [], message: 'No reports assigned.' } })); return;
    }
  }
  if (req.url.startsWith('/api/v1/client/')) {
    res.writeHead(403); res.end(JSON.stringify({ success: false, error_code: 'FORBIDDEN' })); return;
  }
  if (req.url === '/api/v1/webhooks/whatsapp') {
    res.writeHead(503); res.end(JSON.stringify({ success: false })); return;
  }
  if (req.url === '/api/v1/public/leads') {
    res.writeHead(422); res.end(JSON.stringify({ success: false, errors: { mobile: ['Invalid mobile'] } })); return;
  }
  res.writeHead(401); res.end(JSON.stringify({ success: false, error_code: 'UNAUTHENTICATED' }));
});

async function start(configured = true) {
  output = '';
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3310'], {
    env: { ...process.env, BACKEND_URL: configured ? 'http://127.0.0.1:3311' : '', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SITE_URL: origin, ADVISORY_WHATSAPP_APP_SECRET: 'test-app-secret', ADVISORY_WHATSAPP_WEBHOOK_SECRET: 'test-verify-token', FYERS_APP_ID: 'test-app-100', FYERS_REDIRECT_URI: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  app.stdout.on('data', c => { output += c; });
  app.stderr.on('data', c => { output += c; });
  for (let i = 0; i < 240; i++) {
    if (app.exitCode !== null) throw new Error(output);
    try { const r = await fetch(`${origin}/api/v1/me`); if (r.status === (configured ? 401 : 503)) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Next.js did not become ready: ${output}`);
}
async function stop() {
  if (!app || app.exitCode !== null) return;
  const exited = once(app, 'exit'); app.kill('SIGTERM'); await exited;
}
const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('authentication, routing and communication boundaries', { timeout: 180000 }, async t => {
  backend.listen(3311, '127.0.0.1'); await once(backend, 'listening');
  try {
    await start();
    await t.test('broker administration rejects anonymous sessions and automatic login is retired', async () => {
      for (const path of ['login', 'callback', 'auto-login']) {
        assert.equal((await fetch(`${origin}/api/v1/auth/fyers/${path}`, { redirect: 'manual' })).status, 401);
      }
      assert.equal((await fetch(`${origin}/api/v1/auth/fyers/auto-login`, { method: 'POST' })).status, 410);
    });
    await t.test('broker OAuth uses unpredictable state and a fixed same-origin callback', async () => {
      const r = await fetch(`${origin}/api/v1/auth/fyers/login?redirect_uri=https://untrusted.example/callback`, { redirect: 'manual', headers: { Cookie: 'esc_session=verified-admin' } });
      assert.equal(r.status, 307);
      const url = new URL(r.headers.get('location'));
      assert.equal(url.searchParams.get('redirect_uri'), `${origin}/api/v1/auth/fyers/callback`);
      assert.match(url.searchParams.get('state'), /^[a-f0-9]{64}$/);
      assert.match(r.headers.get('set-cookie'), /HttpOnly/);
      const bad = await fetch(`${origin}/api/v1/auth/fyers/callback?auth_code=fake&state=${'é'.repeat(64)}`, { headers: { Cookie: `esc_session=verified-admin; fyers_oauth_state=${'a'.repeat(64)}` } });
      assert.equal(bad.status, 400);
    });
    await t.test('CSRF cookies are issued by the backend', async () => {
      const r = await fetch(`${origin}/sanctum/csrf-cookie`);
      assert.equal(r.status, 204); assert.equal(r.headers.getSetCookie().length, 2);
      assert.match(r.headers.getSetCookie()[1], /csrf-token/);
    });
    await t.test('retired ingress and anonymous certificates cannot mutate local state', async () => {
      for (const path of ['/api/v1/webhooks/tradegrow-leads', '/api/v1/public/send-assessment-email']) {
        assert.equal((await fetch(origin + path, json({}))).status, 410);
      }
    });
    await t.test('failed login remains denied, including an admin-looking email', async () => {
      const r = await fetch(`${origin}/api/v1/auth/login`, json({ email: 'superadmin@example.test', password: 'wrong' }));
      assert.equal(r.status, 401); assert.equal(r.headers.getSetCookie().length, 0);
    });
    await t.test('opaque backend cookies and exact password bytes survive forwarding', async () => {
      const r = await fetch(`${origin}/api/v1/auth/login`, json({ email: 'valid@example.test', password: ' Valid password! ' }));
      assert.equal(r.status, 200); assert.equal(r.headers.getSetCookie().length, 2);
      assert.match(r.headers.getSetCookie()[0], /HttpOnly/);
    });
    await t.test('forged base64 administrator cookie is not trusted', async () => {
      const forged = Buffer.from(JSON.stringify({ user_type: 'staff', permissions: ['*'] })).toString('base64');
      const r = await fetch(`${origin}/api/v1/me`, { headers: { Cookie: `esc_session=${forged}` } });
      assert.equal(r.status, 401); assert.match(r.headers.get('cache-control'), /no-store/);
    });
    await t.test('portal failures never fall back to invented research or invoices', async () => {
      for (const path of ['dashboard', 'research', 'billing']) {
        const r = await fetch(`${origin}/api/v1/client/${path}`);
        assert.equal(r.status, 403); assert.equal((await r.json()).success, false);
      }
    });
    await t.test('multipart data and CSRF header reach the backend unchanged', async () => {
      const form = new FormData(); form.set('document', new Blob(['test-document']), 'example.txt');
      await fetch(`${origin}/api/v1/client/documents`, { method: 'POST', body: form, headers: { 'X-XSRF-TOKEN': 'test-xsrf' } });
      const call = calls.at(-1); assert.match(call.body, /test-document/); assert.equal(call.headers['x-xsrf-token'], 'test-xsrf');
    });
    await t.test('prototype data and send APIs are retired for reads and writes', async () => {
      for (const [path, method] of [['leads','GET'], ['leads','DELETE'], ['whatsapp','POST'], ['subscriptions','GET'], ['invoices','GET'], ['recommendations','POST']]) {
        assert.equal((await fetch(`${origin}/api/v1/office/${path}`, { method })).status, 410);
      }
      assert.equal((await fetch(`${origin}/api/leads/example`, { method: 'PATCH' })).status, 410);
    });
    await t.test('public intake preserves validation failure without duplicate sends', async () => {
      const before = calls.length;
      const r = await fetch(`${origin}/api/v1/public/leads`, json({ full_name: 'Example', mobile: 'invalid' }));
      assert.equal(r.status, 422); assert.equal(calls.length, before + 1);
    });
    await t.test('webhook rejects unsigned payloads before backend processing', async () => {
      const before = calls.length;
      assert.equal((await fetch(`${origin}/internal/advisory/meta-webhook`, json({ entry: [] }))).status, 403);
      assert.equal(calls.length, before);
    });
    await t.test('signed webhook preserves bytes and retryable backend failures', async () => {
      const body = '{ "object": "whatsapp_business_account", "entry": [] }';
      const signature = 'sha256=' + createHmac('sha256', 'test-app-secret').update(body).digest('hex');
      const r = await fetch(`${origin}/internal/advisory/meta-webhook`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature } });
      assert.equal(r.status, 503); assert.equal(calls.at(-1).body, body); assert.equal(calls.at(-1).headers['x-hub-signature-256'], signature);
    });
    await t.test('Meta handshake requires configured verify token', async () => {
      const url = `${origin}/internal/advisory/meta-webhook?hub.mode=subscribe&hub.challenge=123&hub.verify_token=`;
      assert.equal((await fetch(url + 'wrong')).status, 403);
      assert.equal(await (await fetch(url + 'test-verify-token')).text(), '123');
    });
    await t.test('office and nested routes resolve to the canonical backend', async () => {
      for (const path of ['/office', '/office/users']) {
        const r = await fetch(origin + path); assert.equal(r.status, 403); assert.equal((await r.json()).panel, 'canonical-backend');
      }
    });
    await t.test('browser rejects a forged session on the client portal', async () => {
      const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
      try {
        const page = await browser.newPage();
        await page.context().addCookies([{ name: 'esc_session', value: Buffer.from('{"permissions":["*"]}').toString('base64'), url: origin }]);
        await page.goto(`${origin}/portal`);
        await page.waitForURL('**/login?next=**');
        assert.equal(new URL(page.url()).pathname, '/login');
      } finally { await browser.close(); }
    });
    await t.test('client overview shows only the authenticated account data', async () => {
      const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
      try {
        const page = await browser.newPage();
        await page.context().addCookies([{ name: 'esc_session', value: 'verified-client', url: origin }]);
        await page.goto(`${origin}/portal`);
        await page.getByText('TEST-CLIENT-1', { exact: true }).waitFor();
        await page.getByText('No reports assigned.', { exact: true }).waitFor();
        const body = await page.locator('body').innerText();
        assert.match(body, /Not assigned yet/);
        assert.doesNotMatch(body, /HDFCBANK|Arjun Mehta|Sunita Verma|41\.9%|Execute|Transmit/);
      } finally { await browser.close(); }
    });
    await stop(); await start(false);
    await t.test('missing backend fails closed for login and portal', async () => {
      assert.equal((await fetch(`${origin}/api/v1/auth/login`, json({ email: 'admin@example.test', password: 'anything' }))).status, 503);
      assert.equal((await fetch(`${origin}/api/v1/client/research`)).status, 503);
    });
  } finally { await stop(); await new Promise(resolve => backend.close(resolve)); }
});
