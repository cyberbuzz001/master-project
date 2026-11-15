# Stock/option chart and support chat review

## Terminal follow-up

The `/terminal` route is retained with a redesigned mobile header, separate last-price/available-margin tiles, compact workspace tabs, one Buy/Sell bar and a canvas that clears the floating navigation. Terminal surfaces stay dark even when the site preference is light; legacy light-theme remapping excludes the terminal. Help is available from the header instead of a bubble obscuring the chart. The duplicate chart instrument header is hidden inside the terminal.

`GrowwTerminalView` now aborts obsolete quote requests and checks quote token ownership. Query-string symbol changes remount the terminal with the intended contract. Available margin uses buyingPower rather than total cash. Missing quote OHLC is no longer fabricated as percentages of LTP. The order pad can initialize a previously empty price when its first quote arrives without replacing an existing user-entered price.

The screenshot's large candle cannot be attributed conclusively without its history/tick payloads. The removed chart anchoring path could rewrite an old bar with today's quote; its regression test now verifies a new-session tick creates a new bar. Provider history consistency, corporate-action adjustment and production feed verification remain outstanding.

The chart uses TradingView Lightweight Charts 4.2, not TradingView Advanced Charts. This pass unifies the option-strike dialog with the stock chart. Shared features include candles/line/area, seven timeframes, indicator selection, volume visibility, crosshair, pinch zoom/pan, position markers, fullscreen, latest/fit/reload, IST labels and temporary horizontal price levels. Full TradingView parity is not claimed.

## Findings addressed

| File / function | Finding | Correction |
|---|---|---|
| OptionStrikeChartModal / component | Conditional return before hooks; duplicate candle engine; fallback price 100 | Mounted dialog component with shared TradingChart and exact instrument token |
| MobileChartModal / component | Conditional return before freshness hook; trade actions use price 100 | Stable hook order; disable trade actions without a valid quote |
| TradingChart / historical and tick effects | First live tick patched an old candle; old candles remained during reload | Clear obsolete history and aggregate the tick into its proper interval |
| TradingChart / initialization effect | Fullscreen recreated the chart without restoring history | Resize existing instance via ResizeObserver |
| TradingChart.utils / aggregateTickToCandle | Price ticks invented volume and earlier intervals could mutate newer bars | Preserve actual supplied volume; ignore prior-interval ticks |
| TradingChart.utils / normalizeAndSortCandles | Nonfinite OHLC values reach chart library | Reject invalid bars |
| IndicatorEngine / calculateVWAP | Missing volume treated as 100; sessions accumulated together | Require volume and reset accumulation at IST session-day boundaries |
| IndicatorToolbar / component | Indicator panel clipped by scrolling toolbar | Render panel in a portal above the chart |
| TradingChart / indicator controls | Toggle state did not trigger indicator redraw | Render indicator changes and apply volume visibility |
| ChatWidget / handleSend; useMarketSocket / sendChatMessage | Disconnected send cleared an unsent draft | Return socket-send success and retain draft on failure |
| ChatWidget / fetchHistory | Late history response overwrites newly arrived messages | Merge history and socket messages by ID |

## Verification and limits

- Production build and five chart-data unit tests pass.
- Isolated Chromium smoke checks cover stock and option mounting, contract history token, timeframe requests, fullscreen, indicator panel, offline chat and disabled fallback-price trading.
- Browser tests use synthetic fixtures; no production credentials, user messages or orders are submitted.
- Historical candle authenticity/provider availability, broker-volume semantics, full chat delivery acknowledgements and reconnection replay require backend integration verification.
- Horizontal levels are temporary. Persistent drawings, trendlines/Fibonacci, synchronized multi-chart layouts, replay and full indicator panes remain separate work. Full Advanced Charts integration requires confirming licensing and implementing its datafeed interface.
- Physical iPhone/Safari performance and keyboard behavior still require device verification.
