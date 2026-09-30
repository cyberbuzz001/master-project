# Frontend-Backend Integration Matrix

| Screen Name | Frontend Component File | User Action | API Endpoint / WS | DB Table | Permission | Validation |
|---|---|---|---|---|---|---|
| **Trading Terminal** | `TradingTerminal.tsx` | View Chart & Watchlist | `GET /api/v1/market/candles`, `WS: MARKET_TICK` | `instruments`, `watchlists` | `trading.view` | Valid Token |
| **Order Ticket** | `TradingTerminal.tsx` | Submit BUY / SELL | `POST /api/v1/orders` | `orders`, `virtual_wallets` | `trading.order.create` | SubmitOrderSchema |
| **Option Chain** | `OptionChainView.tsx` | Load Expiry & Strikes | `GET /api/v1/market/option-chain` | `instruments` | `trading.view` | Symbol & Expiry |
| **Option Strategy Builder** | `OptionStrategyBuilder.tsx` | Execute Multi-Leg Strategy | `POST /api/v1/orders` | `orders`, `virtual_wallets` | `trading.order.create` | Leg Validation |
| **Level-2 Market Depth** | `MarketDepthView.tsx` | View 5-Level Depth | `GET /api/v1/market/ticks`, `WS: MARKET_TICK` | `instruments` | `trading.view` | Symbol Search |
| **Portfolio & Risk** | `PortfolioAnalyticsView.tsx` | View Capital & Margin | `GET /api/v1/positions`, `GET /api/v1/funds/balance` | `virtual_wallets`, `positions` | `portfolio.view` | Valid Token |
| **Market Scanner** | `MarketScanner.tsx` | View Top Movers | `GET /api/v1/market/ticks` | `instruments` | `trading.view` | None |
| **Admin Control** | `AdminPanel.tsx` | Adjust Balance & Status | `POST /api/v1/admin/adjust-balance` | `users`, `virtual_wallets`, `audit_logs` | `admin.manage` | AdminAdjustBalanceSchema |
