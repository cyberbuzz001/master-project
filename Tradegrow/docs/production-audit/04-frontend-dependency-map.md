# 04 — Frontend Dependency Map

## Entry Point Chain

```
client/src/main.tsx
    └── <App /> (client/src/App.tsx)
        │
        ├── MarketSocketProvider (hooks/useMarketSocket.ts)
        │   ├── Native WebSocket → ws://host/ws?token=JWT
        │   ├── Reconnect with exponential backoff (5 attempts, 1s→30s)
        │   └── requestAnimationFrame batched tick updates
        │
        ├── [Desktop Layout] (window.innerWidth >= 768)
        │   ├── GrowwHeader.tsx
        │   │   ├── Logo, search trigger, theme toggle
        │   │   ├── Wallet balance display (from /api/v1/auth/me)
        │   │   └── Auth state (Login/Logout)
        │   │
        │   ├── GrowwSubNav.tsx
        │   │   └── SubView: EXPLORE | WATCHLIST | TERMINAL | OPTION_CHAIN |
        │   │             ORDERS_POSITIONS | MCX | ADMIN
        │   │
        │   └── [View Router by activeSubView]
        │       ├── EXPLORE → GrowwExploreView.tsx
        │       │   ├── Top Gainers/Losers → GET /market/top-movers
        │       │   ├── NSE Indices → WebSocket ticks
        │       │   └── Market Scanner component
        │       │
        │       ├── WATCHLIST → GrowwWatchlistView.tsx
        │       │   ├── GET /watchlists → watchlist items
        │       │   ├── POST /watchlists/items → add symbol
        │       │   └── DELETE /watchlists/items/:id
        │       │
        │       ├── TERMINAL → GrowwTerminalView.tsx
        │       │   ├── lightweight-charts candlestick
        │       │   ├── GET /market/candles?token=&timeframe=
        │       │   ├── Order book integration
        │       │   └── TradingTerminal.tsx (order panel)
        │       │
        │       ├── OPTION_CHAIN → OptionChainView.tsx
        │       │   ├── GET /market/option-expiries?symbol=
        │       │   ├── SSE /market/option-chain/stream (500ms push)
        │       │   ├── GET /market/option-summary (PCR, MaxPain)
        │       │   └── OrderPreviewModal.tsx → POST /orders
        │       │
        │       ├── ORDERS_POSITIONS → OrdersPositionsView.tsx
        │       │   ├── GET /orders?todayOnly=true
        │       │   ├── GET /portfolio/positions
        │       │   ├── GET /portfolio/holdings
        │       │   ├── GET /portfolio/wallet
        │       │   ├── DELETE /orders/:id (cancel)
        │       │   └── Real-time P&L via WebSocket ticks
        │       │
        │       ├── MCX → McxCommodityView.tsx
        │       │   └── GET /market/mcx-active-contracts
        │       │
        │       └── ADMIN → AdminPanel.tsx
        │           └── [Admin sub-routes]
        │               ├── AdminDashboard → GET /admin/dashboard/executive
        │               ├── CustomerList → GET /admin/users
        │               ├── Customer360 → GET /admin/users/:id
        │               ├── KYCQueue → GET /admin/kyc/queue
        │               ├── FundsDashboard → GET /admin/fund-requests
        │               ├── OrderMonitor → GET /admin/orders
        │               ├── RiskCommandCenter → GET /admin/risk-settings
        │               ├── BrokerHealth → GET /admin/market-data/health
        │               ├── MarketDataAdmin → provider switching
        │               ├── AuditLogViewer → GET /admin/audit-logs
        │               ├── KillSwitch → POST /admin/kill-switch
        │               └── SystemMonitor → GET /health
        │
        └── [Mobile Layout] (window.innerWidth < 768)
            ├── MobileBottomNav.tsx
            └── [Tab Router by activeMobileTab]
                ├── HOME → MobileHomeView.tsx
                ├── PORTFOLIO → MobilePortfolioView.tsx
                ├── OPTION_CHAIN → OptionChainView.tsx (shared)
                ├── ORDERS → OrdersPositionsView.tsx (shared)
                └── PROFILE → MobileProfileView.tsx
```

## Shared Modals (App-level)

| Modal | Trigger | API |
|-------|---------|-----|
| AuthModal.tsx | Not logged in / Login button | POST /auth/login, POST /auth/register |
| GlobalSearchModal.tsx | Search button / Ctrl+K | GET /market/instruments |
| UserProfileModal.tsx | Avatar click | GET /auth/me, POST /kyc/submit |
| CustomerSupportModal.tsx | Support button | POST /support/tickets, GET /support/tickets |

## Hooks Used

| Hook | File | Purpose |
|------|------|---------|
| useMarketSocket | hooks/useMarketSocket.ts | WebSocket tick subscription |
| useMarketTelemetry | hooks/useMarketTelemetry.ts | Telemetry/error logging |
| useTickFreshness | hooks/useTickFreshness.ts | Stale tick detection (>10s) |

## External Libraries

| Library | Usage |
|---------|-------|
| react 19 | UI framework |
| react-dom 19 | DOM rendering |
| lightweight-charts 4.2 | Candlestick + line charts |
| lucide-react 0.474 | Icon set |
| clsx 2.1 | Conditional class names |
| tailwindcss 3.4 | Utility CSS |

## API Communication Pattern

All REST calls use:
- Native `fetch()` with `Authorization: Bearer <JWT>` header
- Base URL: relative `/api/v1/` (proxied in dev via vite.config.ts)
- Token from `localStorage.getItem("token")`
- Auto-refresh via `POST /auth/refresh` on 401
- Auto-logout on refresh failure
