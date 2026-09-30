# Alpha Vantage Market Data Integration Guide

## 1. Executive Summary
This document specifies the integration of the **Alpha Vantage API** into the StockSharp Multi-User Brokerage Simulation Platform as a market data provider for global equities, forex, indices, and historical candle data.

---

## 2. Environment Variable Configuration
The Alpha Vantage API key provided is configured in `.env` and `.env.example`:
```env
ALPHAVANTAGE_API_KEY=CC23XT2DVHARWKAU
PRIMARY_MARKET_DATA_PROVIDER=ANGELONE
```

To activate Alpha Vantage as the primary market data provider, set `PRIMARY_MARKET_DATA_PROVIDER=ALPHAVANTAGE` in `.env`.

---

## 3. Endpoints & REST Architecture

### Real-Time Quotes (`GLOBAL_QUOTE`)
- **Endpoint**: `GET https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey=CC23XT2DVHARWKAU`
- **Output**: Returns real-time LTP, open, high, low, close, volume, change, and percentage change.

### Historical Intraday Candles (`TIME_SERIES_INTRADAY`)
- **Endpoint**: `GET https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval={interval}&apikey=CC23XT2DVHARWKAU`
- **Intervals**: `1min`, `5min`, `15min`, `30min`, `60min`.

---

## 4. Adapter Component (`AlphaVantageAdapter.ts`)
- Implements `IMarketDataProvider`.
- Clean symbol normalizer (`cleanSymbol`) stripping exchange prefixes.
- Fallback candle generator ensuring 100% chart uptime in case of rate limit limits.
- Explicit Safety Lock barrier preventing real-money order execution (`REAL-MONEY TRADING IS DISABLED`).
