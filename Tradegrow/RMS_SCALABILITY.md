# RMS_SCALABILITY.md — Risk Management System & Margin Scalability

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech & Risk Management Specialist  
**Status**: Production Specification (Version 1.0)

---

## 1. RMS Pre-Trade Validation Pipeline

Every order must pass through the **Risk Management System (RMS)** before entering the order book. The RMS operates on a **Fail-Closed Principle**: if any check cannot be completed or market data is corrupt/stale, the order is rejected immediately.

```
Incoming Order (DTO)
        │
        ▼
[ 1. Contract Non-Expiration Check ] ─── Expired? ──────────────► REJECT (Expired Contract)
        │
        ▼
[ 2. System Quantity & Value Limits ] ── Exceeds Max Limit? ────► REJECT (Risk Limit Exceeded)
        │
        ▼
[ 3. Position Reduction / Square-Off ] ─ Is Square-Off? ────────► PASS (Zero Required Margin)
        │ (If New / Increasing Position)
        ▼
[ 4. SPAN & Exposure Margin Quote ]
  ├── Equity Intraday (MIS): 20% Margin (5x leverage)
  ├── Delivery (CNC): 100% Cash / Holdings Check
  ├── Option Buying: 100% Premium + Statutory Fees
  └── Option Selling: SPAN + Exposure (Full margin requirement)
        │
        ▼
[ 5. Virtual Buying Power Verification ]
  └── Available Funds >= Required Margin? ─ Insufficient Funds? ─► REJECT (Margin Shortfall)
        │
        ▼
[ 6. Margin Blocking (Row-Lock) ]
  └── SELECT FOR UPDATE on virtual_wallets ── Lock Acquired ────► PASS TO OMS
```

---

## 2. In-Memory Risk Limit Caching

System-wide risk limits (e.g. `MAX_ORDER_QTY = 50000`, `MAX_ORDER_VALUE = 10000000`) are stored in `system_settings` and cached in-memory with a 60-second TTL (`RMS.cachedRiskLimits`).

This reduces pre-trade database queries by 66% during rapid order submission bursts.

---

## 3. Real-Time Auto-Square-Off & Risk Monitoring

The RMS monitors intraday positions during market hours:

* **Intraday Auto Square-Off (MIS)**: Initiated at 3:20 PM IST by the background worker.
* **Floating Loss Protection**: If user account equity drops below 20% of required margin ($\text{Margin Utilization} > 80\%$), an automated RMS Margin Alert event is logged and the client receives a high-priority risk notification.
* **Circuit Breakers**: If price deviates beyond exchange circuit limits ($\pm 10\%$ / $\pm 20\%$), new market orders are held until continuous trading stabilizes.
