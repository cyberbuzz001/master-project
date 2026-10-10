import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { DhanAdapter } from '../server/src/marketData/DhanAdapter';
import { OptionChainEngine } from '../server/src/marketData/OptionChainEngine';

const clientId = process.env.DHAN_CLIENT_ID || '';
const accessToken = process.env.DHAN_ACCESS_TOKEN || '';
const baseUrl = 'https://api.dhan.co';

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  latencyMs: number;
  details: string;
}

const results: TestResult[] = [];

async function callDhanEndpoint(name: string, category: string, method: 'GET' | 'POST', endpoint: string, body?: any) {
  const start = Date.now();
  try {
    const headers: Record<string, string> = {
      'access-token': accessToken,
      'client-id': clientId,
      'Accept': 'application/json'
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000)
    });

    const latency = Date.now() - start;
    const json: any = await res.json().catch(() => null);

    if (res.ok) {
      results.push({
        category,
        test: name,
        status: 'PASS',
        latencyMs: latency,
        details: `HTTP ${res.status} | OK`
      });
      return { ok: true, data: json, latency };
    } else {
      results.push({
        category,
        test: name,
        status: 'WARN',
        latencyMs: latency,
        details: `HTTP ${res.status}: ${json ? JSON.stringify(json).substring(0, 80) : res.statusText}`
      });
      return { ok: false, data: json, latency };
    }
  } catch (err: any) {
    const latency = Date.now() - start;
    results.push({
      category,
      test: name,
      status: 'FAIL',
      latencyMs: latency,
      details: err.message
    });
    return { ok: false, error: err.message, latency };
  }
}

async function runDhanFullMockSuite() {
  console.log('================================================================');
  console.log('      DHAN HQ END-TO-END UPGRADE & MOCK SESSION TEST SUITE      ');
  console.log('================================================================');
  console.log(`Execution Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log(`Client ID: ${clientId}`);

  // 1. Account, Profile & Fund Limits
  console.log('\n--- 1. Testing Funds & Profile APIs ---');
  await callDhanEndpoint('Fund Limit (/v2/fundlimit)', 'Portfolio & Funds', 'GET', '/v2/fundlimit');

  // 2. Positions & Portfolio
  console.log('\n--- 2. Testing Positions & Holdings APIs ---');
  await callDhanEndpoint('Positions (/v2/positions)', 'Portfolio & Funds', 'GET', '/v2/positions');
  await callDhanEndpoint('Holdings (/v2/holdings)', 'Portfolio & Funds', 'GET', '/v2/holdings');
  await callDhanEndpoint('Trade History (/v2/trades)', 'Portfolio & Funds', 'GET', '/v2/trades');

  // 3. Order Management (Read Order Book)
  console.log('\n--- 3. Testing Order Management APIs ---');
  await callDhanEndpoint('Order Book (/v2/orders)', 'Order Management', 'GET', '/v2/orders');

  // 4. Market Data REST Endpoints
  console.log('\n--- 4. Testing Market Data Endpoints ---');
  await callDhanEndpoint('Marketfeed Quote (/v2/marketfeed/quote)', 'Market Data REST', 'POST', '/v2/marketfeed/quote', {
    IDX_I: [13, 25, 51] // NIFTY, BANKNIFTY, SENSEX
  });

  await callDhanEndpoint('Marketfeed OHLC (/v2/marketfeed/ohlc)', 'Market Data REST', 'POST', '/v2/marketfeed/ohlc', {
    IDX_I: [13, 25]
  });

  // 5. Scrip Master CSV Feed
  console.log('\n--- 5. Testing Instrument Master Scrip Feed ---');
  const scripStart = Date.now();
  try {
    const scripRes = await fetch('https://images.dhan.co/api-data/api-scrip-master.csv', {
      method: 'HEAD',
      signal: AbortSignal.timeout(6000)
    });
    const scripLatency = Date.now() - scripStart;
    if (scripRes.ok) {
      results.push({
        category: 'Instrument Master',
        test: 'Dhan Scrip Master CSV (HEAD)',
        status: 'PASS',
        latencyMs: scripLatency,
        details: `HTTP ${scripRes.status} | Content-Length: ${scripRes.headers.get('content-length') || 'N/A'}`
      });
    } else {
      results.push({
        category: 'Instrument Master',
        test: 'Dhan Scrip Master CSV (HEAD)',
        status: 'WARN',
        latencyMs: scripLatency,
        details: `HTTP ${scripRes.status}`
      });
    }
  } catch (e: any) {
    results.push({
      category: 'Instrument Master',
      test: 'Dhan Scrip Master CSV',
      status: 'FAIL',
      latencyMs: Date.now() - scripStart,
      details: e.message
    });
  }

  // 6. Tradegrow Option Chain Engine Test
  console.log('\n--- 6. Testing Tradegrow Option Chain Engine (NIFTY & SENSEX) ---');
  const ocStart = Date.now();
  try {
    const nseChain = await OptionChainEngine.generateOptionChain({ symbol: 'NIFTY', strikeRange: '5' });
    const ocLatency = Date.now() - ocStart;
    const hasChain = nseChain && Array.isArray(nseChain.chain) && nseChain.chain.length > 0;
    results.push({
      category: 'Option Chain Engine',
      test: 'NIFTY Option Chain Matrix',
      status: hasChain ? 'PASS' : 'WARN',
      latencyMs: ocLatency,
      details: hasChain ? `Spot: ${nseChain.spotPrice}, ATM: ${nseChain.atmStrike}, Strikes: ${nseChain.chain.length}` : 'Empty chain returned'
    });
  } catch (err: any) {
    results.push({
      category: 'Option Chain Engine',
      test: 'NIFTY Option Chain Matrix',
      status: 'FAIL',
      latencyMs: Date.now() - ocStart,
      details: err.message
    });
  }

  // Summary Table
  console.log('\n================================================================');
  console.log('                      TEST RESULTS SUMMARY                      ');
  console.log('================================================================');
  console.table(results.map(r => ({
    Category: r.category,
    Test: r.test,
    Status: r.status,
    'Latency (ms)': r.latencyMs,
    Details: r.details
  })));

  const passCount = results.filter(r => r.status === 'PASS').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  console.log(`\nTotals: ✅ ${passCount} PASSED | ⚠️ ${warnCount} WARNINGS | ❌ ${failCount} FAILED\n`);
}

runDhanFullMockSuite().catch(console.error);
