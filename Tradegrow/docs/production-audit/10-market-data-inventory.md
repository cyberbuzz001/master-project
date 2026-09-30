# 10 — Market Data Inventory

## Provider Architecture

The MarketDataEngine selects ONE primary provider at startup.
All providers implement the IMarketDataProvider interface:
- initialize()
- subscribe(tokens, callback)
- getQuote(token)
- getHistoricalCandles(token, timeframe, count)
- getOptionChain(symbol, expiry)
- isHealthy()
- stop()

## Active Provider: DHAN (PRIMARY)

| Setting | Value |
|---------|-------|
| DHAN_CLIENT_ID | 1113019677 |
| DHAN_ACCESS_TOKEN | eyJ0eXAiOiJKV1Qi... (JWT, expires ~2026) |
| DHAN_API_KEY | 21483ef7 |
| DHAN_API_SECRET | e9730aa4-682c-4e75-... |
| Library | Dhan WebSocket API v2 |
| Status | ACTIVE (PRIMARY_MARKET_DATA_PROVIDER=DHAN) |

Dhan provides:
- Real-time WebSocket tick feed (NSE, BSE, NFO, MCX)
- Historical candles via REST API
- Option chain data

## Secondary Provider: ANGEL ONE (SmartAPI)

| Setting | Value |
|---------|-------|
| ANGELONE_API_KEY | 4DBv6HvT |
| ANGELONE_CLIENT_ID | N89824 |
| ANGELONE_CLIENT_SECRET | 9691 (PIN) |
| ANGELONE_TOTP_SECRET | AV7KF7BEJBOOCVIS53TZZB2VEU |
| Library | SmartAPI WebSocket |
| Status | SECONDARY (configured, inactive when DHAN is primary) |

## Tertiary Provider: TRUEDATA (Replay Mode)

| Setting | Value |
|---------|-------|
| TRUEDATA_USERNAME | Trial208 |
| TRUEDATA_PASSWORD | nikhil208 |
| TRUEDATA_WS_URL | wss://replay.truedata.in:8082 |
| Status | CONFIGURED (replay mode active via URL) |

## Alpha Vantage (Historical/Global)

| Setting | Value |
|---------|-------|
| ALPHAVANTAGE_API_KEY | CC23XT2DVHARWKAU |
| Rate Limit | 25 requests/day (free tier) |
| Status | CONFIGURED — used for historical candles, global indices |

## Indian Stock Market API (RapidAPI)

| Setting | Value |
|---------|-------|
| INDIAN_STOCK_MARKET_API_BASE_URL | https://indian-stock-market-api.p.rapidapi.com |
| Status | KEEP-VERIFY — no API key visible in .env |

## MockMarketDataProvider (Fallback)

| Setting | Value |
|---------|-------|
| Name | MOCK_ENGINE |
| Tick Interval | 500ms |
| Status | ALWAYS AVAILABLE — automatic fallback when market closed or provider unhealthy |

Mock Data Classification: **INTENDED FALLBACK — NOT DEMO DATA**
- Used outside market hours (9:15 AM – 3:30 PM IST Mon-Fri)
- Used when real provider fails health check
- Simulates realistic Indian market prices with random walk
- Clearly labeled MOCK_ENGINE in logs and API responses
- Does NOT reach production users as "real" data — it's explicitly a paper trading platform

## Failover Logic

```
Market Hours Check (every 10s):
├── IN HOURS + Provider Healthy → Use configured primary (DHAN)
├── IN HOURS + Provider Unhealthy → Switch to MOCK_ENGINE
├── OUT OF HOURS + ALLOW_OFF_MARKET_LIVE_DATA=true → Use primary
└── OUT OF HOURS + flag=false → Switch to MOCK_ENGINE
```

## Default Subscribed Tokens (at startup)

```
NSE_NIFTY50, NSE_BANKNIFTY, BSE_SENSEX, NSE_FINNIFTY, NSE_MIDCPNIFTY,
NSE_RELIANCE, NSE_TCS, NSE_INFY, NSE_HDFCBANK, NSE_ICICIBANK, NSE_TATAMOTORS,
MCX_CRUDEOIL, MCX_GOLD, MCX_GOLDM, MCX_SILVERM, MCX_NATURALGAS, MCX_COPPER,
NFO_NIFTY_24500_CE, NFO_NIFTY_24500_PE
```

## NSE Option Chain Service (NseOptionChainService.ts)

Runs every 30 seconds:
- Fetches NSE live index data for NIFTY and SENSEX
- Calculates PCR (Put-Call Ratio)
- Calculates Max Pain strike
- Determines ATM strike
- Provides data to /api/v1/market/option-summary endpoint

## Option Chain Engine (OptionChainEngine.ts)

- Generates complete option chain for any symbol + expiry
- Sources LTP from MarketDataEngine tick cache (real/mock)
- Generates Greeks via GreeksEngine.ts (Black-Scholes)
- Supports: NIFTY, BANKNIFTY, SENSEX, FINNIFTY, MIDCPNIFTY
- Strike step: 50 (NIFTY/FINNIFTY/MIDCPNIFTY), 100 (BANKNIFTY/SENSEX)
- Default range: ATM ± 10 strikes

## Greeks Calculation

Two implementations:
1. **TypeScript (GreeksEngine.ts)** — Black-Scholes analytical, always available
2. **Python (python_engine/services/greeks_service.py)** — py_vollib if available, falls back to analytical

Currently: Node.js backend uses TS implementation. Python engine is standalone microservice.

## Python Files in Wrong Location

**CRITICAL:** The following Python files are placed inside the TypeScript source tree:
- `server/src/marketData/angel_option_chain.py`
- `server/src/marketData/angel_option_ws.py`  
- `server/src/marketData/angel_ticker.py`

These are NOT executed by the Node.js server. They appear to be development experiments.
**Action:** Move to `python_engine/` or archive.

## Real vs Mock Data Summary

| Data Type | During Market Hours | Off-Market |
|-----------|--------------------|-----------| 
| Index LTP (NIFTY/SENSEX) | REAL — Dhan WebSocket | MOCK — random walk |
| Stock LTP | REAL — Dhan WebSocket | MOCK |
| Option LTP | REAL (if subscribed) | MOCK (BS calc) |
| Historical Candles | REAL — Dhan REST | REAL (cached) or synthetic |
| Option Greeks | COMPUTED — Black-Scholes | COMPUTED |
| OI / Volume | REAL from Dhan | MOCK (random) |
| PCR / Max Pain | NSE website scrape (30s) | MOCK |
