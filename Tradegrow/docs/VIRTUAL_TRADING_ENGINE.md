# Virtual Trading Engine Specification

## 1. Virtual Money Accounting
Each newly registered user receives a default virtual capital balance of ₹10,00,000 (10 Lakhs INR).

### Ledger Equation
$$\text{Buying Power} = \text{Cash Balance} - \text{Used Margin}$$

$$\text{Total Equity} = \text{Cash Balance} + \text{Unrealized PnL}$$

---

## 2. Order Execution Simulation Modes

1. **LTP Execution Mode**: Matches MARKET orders directly against the current Last Traded Price (or Bid/Ask spread).
2. **Limit Matching Mode**: Matches LIMIT orders when tick price crosses limit price.
3. **Stop-Loss Mode**: Triggers SL/SL-M orders when market tick breaches trigger price.

---

## 3. Simulated Statutory & Brokerage Fees
- **Simulated Brokerage**: Flat ₹20 or 0.03% per trade (whichever is lower).
- **STT (Securities Transaction Tax)**: 0.1% on Equity Delivery / Sell orders.
- **GST**: 18% on brokerage fees.
- **SEBI / Exchange Turnover Fee**: 0.00345% of total trade turnover.
