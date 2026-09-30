# TradingView Lightweight Charts™ Integration Guide

## 1. Executive Summary & Overview
This document serves as the developer guide for the **TradingView Lightweight Charts™ (v5 API)** module integrated into the StockSharp Brokerage Platform.

---

## 2. Component Architecture

```text
client/src/components/charts/TradingChart/
├── TradingChart.tsx          (Main container & ref-managed Lightweight Charts v5 canvas)
├── TradingChart.types.ts    (TypeScript interfaces for indicators, markers, & configs)
├── TradingChart.utils.ts    (Data normalizer & timestamp deduplicator)
├── IndicatorEngine.ts       (SMA, EMA, WMA, Bollinger Bands, RSI, MACD, VWAP calculations)
└── IndicatorToolbar.tsx     (Searchable indicator selector & config modal)
```

---

## 3. Data Flow & Real-Time Tick Aggregation

```text
[ Backend WebSocket Stream ]  --->  [ TradingTerminal.tsx ]
                                             ↓
                                    [ TradingChart.tsx ]
                                             ↓
                                [ aggregateTickToCandle ]
                                             ↓
                              [ series.update(candle) ]
```

Ticks received via WebSockets are passed into `aggregateTickToCandle()`:
- If tick time falls within the active candle interval, `series.update()` updates the active candle OHLC.
- If tick time crosses into a new timeframe boundary, a new candle is initialized.
- Full `setData()` calls are strictly avoided during live tick updates to eliminate React re-render flicker.

---

## 4. Technical Indicators Supported

| Indicator | Type Key | Configurable Parameters | Calculation Method |
| :--- | :--- | :--- | :--- |
| **Simple Moving Average** | `SMA` | Period (default: 20), Source (close/open) | Rolling average over $N$ periods |
| **Exponential Moving Average** | `EMA` | Period (default: 9), Source | Exponential multiplier $\alpha = \frac{2}{N+1}$ |
| **Weighted Moving Average** | `WMA` | Period (default: 14) | Linear weighted sum |
| **Bollinger Bands** | `BOLLINGER` | Period (20), StdDev Multiplier (2) | Middle SMA +/- $k \cdot \sigma$ |
| **Relative Strength Index** | `RSI` | Period (14) | Smoother Average Gain / Average Loss |
| **MACD** | `MACD` | Fast (12), Slow (26), Signal (9) | EMA(12) - EMA(26), Signal EMA(9) |
| **VWAP** | `VWAP` | Session resets | Volume Weighted Average Price |

---

## 5. Adding New Technical Indicators

To extend the indicator suite:
1. Add new indicator type string to `IndicatorConfig` in `TradingChart.types.ts`.
2. Implement calculation method in `IndicatorEngine.ts`.
3. Register the indicator definition in `availableCatalog` within `IndicatorToolbar.tsx`.
4. Render line/histogram series in `TradingChart.tsx::renderIndicators()`.

---

## 6. Trading Markers & Attribution

- **Order Markers**: Executed BUY/SELL orders rendered as arrowUp/arrowDown markers directly on the candlestick series.
- **Position Price Lines**: Open position entry prices displayed as dashed price lines with unrealized PnL tags.
- **Attribution Compliance**: TradingView attribution link rendered in footer in accordance with TradingView Lightweight Charts license requirements.
