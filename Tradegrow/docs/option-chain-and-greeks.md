# Dynamic Option Chain Matrix & Black-Scholes Greeks Engine

## 1. Executive Summary
This document specifies the quantitative pricing model and dynamic contract discovery engine for options within the StockSharp Multi-User Brokerage Simulation Platform.

---

## 2. Dynamic Option Chain Matrix Discovery

`OptionChainEngine` dynamically resolves active option contracts around the current underlying spot price:
1. Queries current spot price from active market data provider (`MarketDataEngine.getInstance().getQuote('NSE_NIFTY50')`).
2. Calculates nearest ATM strike price:
   $$\text{Base Strike} = \text{Round}\left(\frac{S}{\text{Step}}\right) \times \text{Step}$$
3. Generates ITM, ATM, and OTM strike levels.
4. Computes Call and Put intrinsic values and time decay premiums.

---

## 3. Black-Scholes Option Pricing & Greeks Formulae

### Cumulative Standard Normal Distribution $N(x)$
$$N(x) = \frac{1}{\sqrt{2\pi}} \int_{-\infty}^{x} e^{-\frac{t^2}{2}} dt$$

### $d_1$ and $d_2$ Equations
$$d_1 = \frac{\ln(S / K) + \left(r + \frac{\sigma^2}{2}\right) T}{\sigma \sqrt{T}}$$
$$d_2 = d_1 - \sigma \sqrt{T}$$

### Option Greeks Summary
- **Call Delta ($\Delta_{CE}$)**: $N(d_1)$
- **Put Delta ($\Delta_{PE}$)**: $N(d_1) - 1$
- **Gamma ($\Gamma$)**: $\frac{N'(d_1)}{S \cdot \sigma \sqrt{T}}$
- **Theta ($\Theta$)**: Daily time decay expressed in points per calendar day
- **Vega ($V$)**: Price sensitivity per 1% change in Implied Volatility
