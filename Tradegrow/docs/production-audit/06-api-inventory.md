# 06 — API Inventory

## Authentication APIs

| Method | Path | Auth | Role | Frontend Caller | Status |
|--------|------|------|------|-----------------|--------|
| POST | /api/v1/auth/register | None | - | AuthModal.tsx | LIVE |
| POST | /api/v1/auth/login | None | - | AuthModal.tsx | LIVE |
| GET | /api/v1/auth/me | Bearer | Any | App.tsx (fetchWallet) | LIVE |
| POST | /api/v1/auth/refresh | None | - | App.tsx | LIVE |
| POST | /api/v1/auth/logout | Bearer | Any | GrowwHeader.tsx | LIVE |

## Health APIs

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | /api/v1/health | None | LIVE |
| GET | /api/v1/health/live | None | LIVE |
| GET | /api/v1/health/ready | None | LIVE |
| GET | /api/v1/health/instruments | None | LIVE |

## Market Data APIs

| Method | Path | Auth | Frontend Caller | Status |
|--------|------|------|-----------------|--------|
| GET | /api/v1/market/instruments | None | GlobalSearchModal | LIVE |
| GET | /api/v1/market/quote/:token | None | Various | LIVE |
| GET | /api/v1/market/candles | None | ChartWindow | LIVE (dual route — see note) |
| GET | /api/v1/market/local-candles | None | TradingTerminal | LIVE |
| GET | /api/v1/market/option-chain | None | OptionChainView | LIVE |
| GET | /api/v1/market/option-chain/stream | None | OptionChainView | LIVE (SSE) |
| GET | /api/v1/market/option-expiries | None | OptionChainView | LIVE |
| GET | /api/v1/market/option-summary | None | OptionChainView | LIVE |
| GET | /api/v1/market/top-movers | None | GrowwExploreView | LIVE |
| GET | /api/v1/market/mcx-active-contracts | None | McxCommodityView | LIVE |
| POST | /api/v1/optionchain | None | External/OpenAlgo compat | LIVE |

**NOTE: Duplicate Route — /api/v1/market/candles**
There are TWO handlers for `GET /api/v1/market/candles` registered in api.ts:
- Line 267: Delegates to MarketDataEngine.getHistoricalCandles() (real provider data)
- Line 603: Generates synthetic OHLC candles with Black-Scholes option pricing

Express uses FIRST MATCH wins. The second route (synthetic candles) is UNREACHABLE in production.
**RECOMMENDATION:** Remove or rename the second handler to `/api/v1/market/synthetic-candles`.

## Margin APIs

| Method | Path | Auth | Frontend Caller | Status |
|--------|------|------|-----------------|--------|
| GET | /api/v1/margin/quote | Bearer | OrderPreviewModal | LIVE |
| POST | /api/v1/margin/portfolio | Bearer | OrdersPositionsView | LIVE |

## Order APIs

| Method | Path | Auth | Frontend Caller | Status |
|--------|------|------|-----------------|--------|
| POST | /api/v1/orders | Bearer | OrderPreviewModal | LIVE |
| POST | /api/v1/orders/place | Bearer | TradingTerminal | LIVE (duplicate of /orders) |
| GET | /api/v1/orders | Bearer | OrdersPositionsView | LIVE |
| DELETE | /api/v1/orders/:id | Bearer | OrdersPositionsView | LIVE |

**NOTE: Duplicate Order Placement**
`POST /api/v1/orders` and `POST /api/v1/orders/place` are identical implementations.
**RECOMMENDATION:** Consolidate to single endpoint, redirect one to the other.

## Portfolio APIs

| Method | Path | Auth | Frontend Caller | Status |
|--------|------|------|-----------------|--------|
| GET | /api/v1/portfolio/wallet | Bearer | Various | LIVE |
| GET | /api/v1/portfolio/positions | Bearer | OrdersPositionsView | LIVE |
| GET | /api/v1/portfolio/holdings | Bearer | GrowwHoldingsView | LIVE |

## Funds APIs

| Method | Path | Auth | Frontend Caller | Status |
|--------|------|------|-----------------|--------|
| POST | /api/v1/funds/request | Bearer | UserProfileModal | LIVE |
| GET | /api/v1/funds/my-requests | Bearer | UserProfileModal | LIVE |
| POST | /api/v1/funds/instant | Bearer | UserProfileModal | LIVE |

## Watchlist APIs

| Method | Path | Auth | Frontend Caller | Status |
|--------|------|------|-----------------|--------|
| GET | /api/v1/watchlists | Bearer | GrowwWatchlistView | LIVE |
| POST | /api/v1/watchlists | Bearer | GrowwWatchlistView | LIVE |
| POST | /api/v1/watchlists/items | Bearer | GrowwWatchlistView | LIVE |
| DELETE | /api/v1/watchlists/items/:id | Bearer | GrowwWatchlistView | LIVE |

## KYC APIs

| Method | Path | Auth | Frontend Caller | Status |
|--------|------|------|-----------------|--------|
| GET | /api/v1/kyc/status | Bearer | UserProfileModal | LIVE |
| POST | /api/v1/kyc/submit | Bearer | UserProfileModal | LIVE (multipart) |

## Support APIs

| Method | Path | Auth | Frontend Caller | Status |
|--------|------|------|-----------------|--------|
| GET | /api/v1/support/tickets | Bearer | CustomerSupportModal | LIVE |
| POST | /api/v1/support/tickets | Bearer | CustomerSupportModal | LIVE |

## User Admin APIs (api.ts)

| Method | Path | Auth | Role | Status |
|--------|------|------|------|--------|
| GET | /api/v1/admin/dashboard | Bearer | ADMIN+ | LIVE |
| GET | /api/v1/admin/users | Bearer | ADMIN+ | LIVE |
| POST | /api/v1/admin/users/:id/adjust-balance | Bearer | SUPER_ADMIN/ADMIN | LIVE |
| POST | /api/v1/admin/users/:id/status | Bearer | SUPER_ADMIN/ADMIN | LIVE |
| POST | /api/v1/admin/users/:id/role | Bearer | SUPER_ADMIN | LIVE |
| GET | /api/v1/admin/audit-logs | Bearer | ADMIN+ | LIVE |
| GET | /api/v1/admin/risk-settings | Bearer | RISK_MANAGER+ | LIVE |
| POST | /api/v1/admin/risk-settings | Bearer | RISK_MANAGER+ | LIVE |
| POST | /api/v1/admin/instruments/sync | Bearer | SUPER_ADMIN/ADMIN | LIVE |
| GET | /api/v1/admin/instruments/versions | Bearer | ADMIN+ | LIVE |
| GET | /api/v1/admin/feature-flags | Bearer | SUPER_ADMIN/ADMIN | LIVE |

## Admin API Routes (adminApi.ts — /api/v1/admin/*)

| Method | Path | Role | Status |
|--------|------|------|--------|
| GET | /dashboard/executive | ADMIN_ROLES | LIVE |
| GET | /customers | ADMIN_ROLES | LIVE |
| GET | /customers/:id | ADMIN_ROLES | LIVE |
| GET | /orders | ADMIN_ROLES | LIVE |
| GET | /fund-requests | ADMIN_ROLES | LIVE |
| POST | /fund-requests/:id/approve | ADMIN/FINANCE | LIVE |
| POST | /fund-requests/:id/reject | ADMIN/FINANCE | LIVE |
| GET | /kyc/queue | KYC_OFFICER/ADMIN | LIVE |
| POST | /kyc/:id/approve | KYC_OFFICER/ADMIN | LIVE |
| POST | /kyc/:id/reject | KYC_OFFICER/ADMIN | LIVE |
| GET | /risk-events | RISK_MANAGER | LIVE |
| GET | /market-data/health | ADMIN_ROLES | LIVE |
| POST | /market-data/switch-provider | SUPER_ADMIN | LIVE |
| GET | /market-data/live-ticks | ADMIN_ROLES | LIVE |
| POST | /market-data/update-credentials | SUPER_ADMIN | LIVE |
| GET | /ledger/:userId | FINANCE_MANAGER | LIVE |
| DELETE | /orders/:id | SUPER_ADMIN/RISK | LIVE (admin cancel) |
| POST | /kill-switch | SUPER_ADMIN/RISK | LIVE |

## WebSocket API

| Endpoint | Protocol | Auth | Status |
|----------|----------|------|--------|
| /ws | WebSocket | Optional JWT via ?token= | LIVE |

### WebSocket Message Types

**Server → Client:**
- `TICK_SNAPSHOT` — initial bulk tick data on connect
- `MARKET_TICK` — real-time price update for subscribed tokens
- `PONG` — heartbeat response

**Client → Server:**
- `{action: "SUBSCRIBE", tokens: [...]}` — subscribe to tokens
- `{action: "UNSUBSCRIBE", tokens: [...]}` — unsubscribe
- `{action: "PING"}` — keepalive ping

## Known API Issues

1. **Duplicate `/api/v1/market/candles` route** — second handler unreachable
2. **Duplicate order endpoints** (`/orders` and `/orders/place`) — identical logic
3. **Missing Python Engine integration** — `/api/v1/greeks` not called from Node.js backend (GreeksEngine.ts is pure TS)
4. **`/api/v1/admin` prefix collision** — routes in api.ts under `/admin/*` and adminApi.ts both register admin routes, potential for confusion
