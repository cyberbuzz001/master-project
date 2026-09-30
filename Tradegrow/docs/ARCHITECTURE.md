# System Architecture & Technical Specification

## 1. System Overview
The StockSharp Brokerage Simulation Platform is an enterprise multi-user paper trading system designed for simulated financial trading, real-time market data broadcasting, risk management, option chain analytics, and brokerage administration.

---

## 2. Technical Safeguards & Business Integrity
- **Virtual Currency Lock**: All operations execute against simulated capital accounts.
- **Fail-Closed Execution Guard**: `SafetyLock.assertSimulationOnly` explicitly blocks order routing to external brokers.
- **Market Data Scope**: External APIs (Angel One API and Indian Stock Market API) are strictly used for quote, candle, and option chain ingestion.

---

## 3. High-Level Component Topology

```text
[ React Trading Terminal (Vite + TS) ]  <--->  [ WebSocket Gateway (/ws) ]
                   |                                       |
                   v                                       v
[ Versioned REST API (/api/v1/*) ]       [ Real-Time Market Tick Bus ]
                   |                                       |
     ---------------------------------------------------------
     |             |             |             |             |
   [Auth/RBAC]  [OMS]         [RMS]      [Portfolio]   [Admin]
     |             |             |             |             |
     ---------------------------------------------------------
                   |                                       |
                   v                                       v
     [ Virtual Wallet Ledger ]                  [ Market Data Engine ]
    (Double-Entry ACID Journal)                 (Angel One / Indian API / Mock)
```

---

## 4. Subsystem Specifications

### 4.1 Market Data Pipeline
- `IMarketDataProvider`: Standardized interface.
- `AngelOneAdapter`: Connects to Angel One market quote endpoints with fallback capabilities.
- `IndianStockMarketApiAdapter`: Fallback market data adapter.
- `MockMarketDataProvider`: High-speed simulated tick engine generating Brownian price ticks and option chains.
- `MarketDataEngine`: Failover controller and tick cache manager.

### 4.2 Order Management System (OMS)
- State transitions: `CREATED` → `RMS_CHECK` → `ACCEPTED` → `PENDING` → `FILLED` / `REJECTED` / `CANCELLED`.

### 4.3 Risk Management System (RMS)
- Pre-trade validation of available buying power, maximum order quantity, maximum order value, and product leverage (5x for MIS Intraday, 100% for CNC Delivery).

### 4.4 Double-Entry Virtual Wallet Ledger
- Tracks cash balance, used margin, realized PnL, unrealized PnL, and produces immutable audit entries (`wallet_ledger`).
