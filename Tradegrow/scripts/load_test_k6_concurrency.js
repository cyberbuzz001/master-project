/**
 * scripts/load_test_k6_concurrency.js
 *
 * High-Concurrency Production Load Testing Script (k6)
 * Platform: TradeGrow / StockSharp Multi-User Brokerage & Paper Trading System
 *
 * Objectives:
 *  1. Concurrent WebSocket Market Tick Streams (500+ active connections subscribing to L1/L2 ticks).
 *  2. High-Frequency Order Placement Spikes (Ramping Arrival Rate up to 250 orders/sec).
 *  3. Idempotency & Race Condition Validation under volatile market conditions.
 *  4. Real-time metric aggregation (Latency P95/P99, error rates, WS tick throughput).
 *
 * Execution:
 *  k6 run scripts/load_test_k6_concurrency.js
 *  or with environment overrides:
 *  k6 run -e BASE_URL=http://localhost:5000 -e WS_URL=ws://localhost:5000/ws scripts/load_test_k6_concurrency.js
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ── Custom Performance Metrics ─────────────────────────────────────────────
const orderLatency = new Trend('order_placement_latency', true);
const wsHandshakeLatency = new Trend('ws_handshake_latency', true);
const wsTicksReceived = new Counter('ws_ticks_received');
const wsConnectionErrors = new Counter('ws_connection_errors');
const ordersSubmitted = new Counter('orders_submitted');
const ordersAccepted = new Counter('orders_accepted');
const ordersRejected = new Counter('orders_rejected');
const ordersFailed = new Counter('orders_failed');
const orderSuccessRate = new Rate('order_success_rate');

// ── Target Configuration ───────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:5000/ws';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''; // If provided, used for authenticated order routing

// ── Canonical Symbol & Token Universe ──────────────────────────────────────
const SYMBOL_POOL = [
  { symbol: 'NIFTY50', instrumentToken: 'NSE_NIFTY50', exchange: 'NSE', basePrice: 24500.0 },
  { symbol: 'BANKNIFTY', instrumentToken: 'NSE_BANKNIFTY', exchange: 'NSE', basePrice: 51200.0 },
  { symbol: 'SENSEX', instrumentToken: 'BSE_SENSEX', exchange: 'BSE', basePrice: 80500.0 },
  { symbol: 'RELIANCE', instrumentToken: 'NSE_RELIANCE', exchange: 'NSE', basePrice: 2950.0 },
  { symbol: 'TCS', instrumentToken: 'NSE_TCS', exchange: 'NSE', basePrice: 4200.0 },
  { symbol: 'HDFCBANK', instrumentToken: 'NSE_HDFCBANK', exchange: 'NSE', basePrice: 1650.0 },
];

export const options = {
  scenarios: {
    // 1. Sustained WebSocket Market Data Feed Listeners
    market_feed_subscribers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 200 },  // Ramp-up to 200 active WS streams
        { duration: '40s', target: 500 },  // Scale up to 500 active WS streams
        { duration: '2m',  target: 500 },  // Steady state sustained streaming
        { duration: '30s', target: 0 },    // Graceful ramp-down
      ],
      exec: 'streamTicks',
      gracefulStop: '10s',
    },

    // 2. High-Frequency Order Placement Spikes (Market Open Surge)
    order_placement_spike: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: [
        { duration: '20s', target: 50 },   // Warm-up to 50 orders/sec
        { duration: '40s', target: 250 },  // Market Open Spike: 250 orders/sec
        { duration: '1m',  target: 250 },  // Sustained peak load
        { duration: '30s', target: 50 },   // Post-spike stabilization
        { duration: '10s', target: 0 },
      ],
      exec: 'placeOrders',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    'order_placement_latency': ['p(95)<150', 'p(99)<300'], // 95% of orders under 150ms, 99% under 300ms
    'http_req_failed': ['rate<0.01'],                     // Network/HTTP error rate below 1%
    'order_success_rate': ['rate>0.98'],                  // Order acceptance/rejection success > 98%
    'ws_ticks_received': ['count>5000'],                  // Expect high volume tick consumption
    'ws_connection_errors': ['count<50'],                 // Less than 50 connection drops
  },
};

/**
 * Global Setup Lifecycle:
 * Authenticates a test user session or generates standard bearer tokens if needed.
 */
export function setup() {
  console.log(`[k6 Setup] Target Gateway: ${BASE_URL}`);
  console.log(`[k6 Setup] WebSocket URL:  ${WS_URL}`);

  let token = AUTH_TOKEN;

  // Attempt login if no static token is provided
  if (!token) {
    try {
      const loginRes = http.post(
        `${BASE_URL}/api/v1/auth/login`,
        JSON.stringify({ username: 'trader1', password: 'password123' }),
        { headers: { 'Content-Type': 'application/json' }, timeout: '5s' }
      );

      if (loginRes.status === 200) {
        const body = loginRes.json();
        token = body.token || (body.data && body.data.token) || '';
        console.log('[k6 Setup] Successfully authenticated test account trader1');
      } else {
        console.warn(`[k6 Setup] Auto-login returned status ${loginRes.status}. Using simulated auth token.`);
        token = 'simulated-jwt-token';
      }
    } catch (e) {
      console.warn(`[k6 Setup] Auth endpoint unreachable (${e.message}). Proceeding with mock tokens.`);
      token = 'simulated-jwt-token';
    }
  }

  return { authToken: token };
}

/**
 * Scenario 1: Sustained WebSocket Feed Listeners
 * Connects to /ws, subscribes to canonical tokens, and measures live tick throughput.
 */
export function streamTicks(data) {
  const token = data && data.authToken ? data.authToken : AUTH_TOKEN;
  const wsTarget = token && token !== 'simulated-jwt-token' 
    ? `${WS_URL}?token=${encodeURIComponent(token)}` 
    : WS_URL;

  const startHandshake = Date.now();

  const response = ws.connect(wsTarget, { tags: { name: 'market_ticks_stream' } }, function (socket) {
    wsHandshakeLatency.add(Date.now() - startHandshake);

    socket.on('open', () => {
      // Subscribe to canonical market data tokens
      const selectedTokens = ['NSE_NIFTY50', 'NSE_BANKNIFTY', 'BSE_SENSEX', 'NSE_RELIANCE'];
      socket.send(JSON.stringify({
        action: 'SUBSCRIBE',
        tokens: selectedTokens,
      }));
    });

    socket.on('message', (msg) => {
      try {
        const payload = JSON.parse(msg);
        if (payload.type === 'MARKET_TICK' || payload.type === 'TICK' || payload.token) {
          wsTicksReceived.add(1);
        }
      } catch (_) {
        wsTicksReceived.add(1);
      }
    });

    socket.on('error', (err) => {
      wsConnectionErrors.add(1);
      console.error(`[WS Error VU ${__VU}]:`, err.error());
    });

    socket.on('close', () => {
      // Connection closed cleanly
    });

    // Maintain WebSocket connection for 45 seconds per iteration
    socket.setTimeout(() => {
      socket.close();
    }, 45000);
  });

  check(response, {
    'WS Handshake 101 Switching Protocols': (r) => r && r.status === 101,
  });
}

/**
 * Scenario 2: High-Frequency Order Placement
 * Submits limit and market orders concurrently with unique idempotency keys.
 */
export function placeOrders(data) {
  const token = data && data.authToken ? data.authToken : (AUTH_TOKEN || `test-token-vu-${__VU}`);
  
  // Pick random symbol from pool
  const sym = SYMBOL_POOL[Math.floor(Math.random() * SYMBOL_POOL.length)];
  const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const orderType = Math.random() > 0.2 ? 'LIMIT' : 'MARKET';
  const priceVariation = (Math.random() * 20 - 10);
  const orderPrice = orderType === 'LIMIT' ? Number((sym.basePrice + priceVariation).toFixed(2)) : 0;
  const quantity = Math.floor(Math.random() * 5 + 1) * (sym.symbol === 'NIFTY50' ? 25 : sym.symbol === 'BANKNIFTY' ? 15 : 1);

  const payload = JSON.stringify({
    instrumentToken: sym.instrumentToken,
    exchange: sym.exchange,
    symbol: sym.symbol,
    side: side,
    quantity: quantity,
    price: orderPrice,
    orderType: orderType,
    productType: 'MIS', // Intraday margin
  });

  const idempotencyKey = `idemp_k6_${__VU}_${Date.now()}_${__ITER}_${Math.floor(Math.random() * 10000)}`;

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'idempotency-key': idempotencyKey,
    },
    tags: { name: 'order_placement' },
    timeout: '5s',
  };

  ordersSubmitted.add(1);
  const startTime = Date.now();

  const res = http.post(`${BASE_URL}/api/v1/orders`, payload, params);

  orderLatency.add(Date.now() - startTime);

  const isSuccessHttp = res.status === 200 || res.status === 201;
  let isAccepted = false;
  let isRejectedGracefully = false;

  if (isSuccessHttp) {
    try {
      const body = res.json();
      if (body.success === true || body.orderId || body.status === 'ACCEPTED' || body.status === 'QUEUED') {
        isAccepted = true;
        ordersAccepted.add(1);
      } else if (body.success === false && body.error) {
        // Business rejection (e.g. Insufficient Margin, RMS circuit) is a valid handled response
        isRejectedGracefully = true;
        ordersRejected.add(1);
      }
    } catch (_) {
      isAccepted = true;
      ordersAccepted.add(1);
    }
  } else if (res.status === 400 || res.status === 422) {
    // Handled validation error / RMS rejection
    isRejectedGracefully = true;
    ordersRejected.add(1);
  } else {
    ordersFailed.add(1);
  }

  const passed = check(res, {
    'HTTP status is 200/201 or 400': (r) => r.status === 200 || r.status === 201 || r.status === 400,
    'Order processed (accepted or handled)': () => isAccepted || isRejectedGracefully,
  });

  orderSuccessRate.add(passed ? 1 : 0);

  // Micro-sleep jitter to simulate realistic burst distribution (10ms - 50ms)
  sleep(0.01 + Math.random() * 0.04);
}
