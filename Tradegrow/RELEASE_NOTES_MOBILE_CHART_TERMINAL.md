# Mobile, chart and terminal update

## Changes

- Removed duplicated bottom padding on Home, Watchlist and Orders/Positions; restored sticky header scrolling; made all header categories fit at 320px.
- Replaced oversized mobile market-mover cards with compact rows and added larger search/filter/order controls.
- Removed hardcoded Home/option-screen prices when data is absent; added unavailable/loading states instead of false live prices or Neutral PCR.
- Cancelled obsolete option-chain/expiry requests during selection changes.
- Unified stock and option-strike charts around the shared TradingView Lightweight Charts implementation.
- Added seven timeframe controls, Latest/Fit/Reload, volume visibility, temporary price levels and an unclipped indicator dialog; repaired indicator toggles and fullscreen resizing.
- Prevented earlier-interval ticks from changing newer candles; removed fabricated volume and corrected VWAP volume/session handling.
- Removed chart trade actions' arbitrary fallback prices. Preserved exact option instrument tokens, contract switching, Greeks and position markers.
- Redesigned /terminal for phone widths with separate last-price/available-margin tiles, readable dark surfaces, compact workspace tabs and one Buy/Sell action bar.
- Isolated legacy light-theme overrides from the terminal, cancelled obsolete quote requests, and used available margin rather than total cash.
- Removed the support launcher over the terminal chart; Help remains available through the terminal header.
- Preserved chat drafts when socket sending fails; merged late-loaded history with newly received messages.
- Show the automatic install banner only when browser installation is available; retain manual install help.

## Verification completed

- `npm run build`: server TypeScript and client production build passed.
- Five focused Jest suites / 12 tests passed: candle integrity, execution snapshots, order mutation races, signed-wallet settlement and tick ordering.
- `node scripts/test-mobile-navigation.cjs`: passed with isolated API fixtures.
- `node scripts/test-chart-experience.cjs`: passed with isolated API fixtures.
- `node scripts/test-terminal-layout.cjs`: passed at 320px and 390px, including a light-site-preference contrast check.
- `git diff --check`: passed.

Browser scripts require a local Vite server on port 3000, Playwright, and Chromium (`CHROMIUM_PATH` can override the executable). These tests do not contact production or place actual orders.

## Remaining checks and scope limits

- VPS deployment and live API/WebSocket verification remain outstanding; the previous deployment attempt could not connect to the VPS over SSH.
- Physical iPhone/Safari verification remains outstanding.
- Production database/Redis integration and the full backend suite are not certified by these focused tests.
- The signed-wallet migration from the prior release must be confirmed on the production database before relying on negative cash balances there.
- This release uses Lightweight Charts, not TradingView Advanced Charts. Persistent drawings, full drawing tools, replay and synchronized chart layouts remain separate work.
- Full historical admin order/trade correction and ledger replay remain unfinished; this release does not claim to provide them.

See `CHART_AND_CHAT_AUDIT.md` for the chart, terminal and chat findings and their verification limits.
