# TradingView Lightweight Charts™ Integration Plan

## 1. Executive Summary & Existing System Audit

The StockSharp Brokerage Simulation Platform is equipped with a Node.js / Express / TypeScript backend, SQLite database with double-entry virtual money ledger, real-time WebSocket market ticker gateway, and a Vite + React + TypeScript dark financial terminal UI.

This document details the production integration plan for **TradingView Lightweight Charts™ (v5 API)** to replace ad-hoc chart components with an institutional-grade, multi-timeframe, multi-indicator charting engine.

---

## 2. Market Data Flow & Architecture

```text
[ Angel One API / Simulated Feed ]
              ↓
  [ Market Data Engine ]
              ↓
[ Backend WebSocket Gateway (/ws) ]  <--->  [ REST API (/api/v1/market/candles) ]
              ↓                                         ↓
   [ Client WebSocket Stream ]               [ Historical Candle Fetch ]
              ↓                                         ↓
   [ Realtime Candle Aggregator ]            [ Timestamp Normalizer & Deduplicator ]
              └────────────────────────┬────────────────────────┘
                                       ↓
                          [ Lightweight Charts Engine ]
```

---

## 3. Data Normalization & Timestamp Strategy

- **Intraday Time Resolution**: Unix integer timestamps in seconds (`Math.floor(Date.now() / 1000)`).
- **Strict Sorting & Deduplication**:
  ```typescript
  const uniqueSorted = Array.from(
    new Map(candles.map(c => [c.time, c])).values()
  ).sort((a, b) => a.time - b.time);
  ```
- **Incremental Real-Time Tick Update**:
  Incoming ticks are aggregated into the current timeframe candle (calculating open, high, low, close) and updated via `series.update()` without invoking `setData()` or triggering full React component re-renders.

---

## 4. Subsystem Components & Structure

```text
client/src/components/charts/TradingChart/
├── TradingChart.tsx          (Main container & ref-managed Lightweight Charts canvas)
├── TradingChart.types.ts    (TypeScript interfaces for indicators, markers, & configs)
├── TradingChart.config.ts   (Lightweight Charts v5 theme options & colors)
├── TradingChart.utils.ts    (Data normalizer & timestamp deduplicator)
├── IndicatorEngine.ts       (SMA, EMA, WMA, Bollinger Bands, RSI, MACD, VWAP calculations)
└── IndicatorToolbar.tsx     (Interactive indicator selector & config modal)
```

---

## 5. Indicator Calculation Engine Specs

1. **SMA (Simple Moving Average)**: $SMA_t = \frac{1}{N}\sum_{i=0}^{N-1} P_{t-i}$
2. **EMA (Exponential Moving Average)**: $EMA_t = P_t \cdot \alpha + EMA_{t-1} \cdot (1 - \alpha)$, where $\alpha = \frac{2}{N+1}$
3. **Bollinger Bands**: Middle = SMA(N), Upper = Middle + ($k \cdot \sigma$), Lower = Middle - ($k \cdot \sigma$)
4. **RSI (Relative Strength Index)**: $RSI = 100 - \frac{100}{1 + RS}$, $RS = \frac{\text{Average Gain}}{\text{Average Loss}}$
5. **MACD**: MACD Line = EMA(12) - EMA(26), Signal Line = EMA(9) of MACD Line, Histogram = MACD Line - Signal Line
6. **VWAP (Volume Weighted Average Price)**: $VWAP = \frac{\sum (Price \cdot Volume)}{\sum Volume}$

---

## 6. Order & Position Marker Integration

- **Order Markers**: Executed Buy/Sell orders rendered as price line markers (`shape: 'arrowUp' / 'arrowDown'`, `color: '#10b981' / '#ef4444'`).
- **Open Position Lines**: Dynamic price line representing current net position average price with unrealized PnL tag.

---

## 7. Affected Files Overview

### Files to be Created:
- `docs/lightweight-charts-integration-plan.md`
- `docs/lightweight-charts-integration.md`
- `client/src/components/charts/TradingChart/TradingChart.types.ts`
- `client/src/components/charts/TradingChart/TradingChart.utils.ts`
- `client/src/components/charts/TradingChart/IndicatorEngine.ts`
- `client/src/components/charts/TradingChart/IndicatorToolbar.tsx`
- `client/src/components/charts/TradingChart/TradingChart.tsx`
- `tests/chart_indicators.test.ts`

### Files to be Modified:
- `client/src/components/TradingTerminal.tsx`
- `client/src/components/ChartWindow.tsx`
