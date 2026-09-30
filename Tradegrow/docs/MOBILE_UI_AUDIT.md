# Mobile UI Audit Document — Desktop to Mobile Conversion

## Overview
This document provides a comprehensive component-by-component and page-by-page audit of the current desktop brokerage platform, identifying mobile responsive issues and detailing the mobile-first UX solutions required for production-ready mobile and tablet responsiveness (320px – 1024px+).

---

## 1. Global App Layout & Navigation Audit

| Page / Component | Current Desktop Behavior | Mobile Problem (< 768px) | Required Mobile UX Solution | Target Viewports |
|---|---|---|---|---|
| **App Shell & Layout** | Fixed top `GrowwHeader` + `GrowwSubNav` horizontal bar + desktop view area. | Overcrowded header, cramped sub-nav, unoptimized screen real estate. | **App Shell Transformation**: Fixed compact mobile header (Logo, Search, Alerts, Profile) + fixed **Mobile Bottom Navigation** (Home, Markets, Orders, Portfolio, Admin/More). | 320px – 768px |
| **Global Search** | Modal with search input, stock/index suggestions, and strike chips. | Desktop modal takes full center with standard margins; keypresses covered by virtual keyboard. | Mobile full-screen search drawer with recent searches, quick exchange tags (NSE, BSE, NFO, MCX), and touch-friendly strike chips. | 320px – 480px |
| **Authentication Modal** | Centered desktop dialog box (`AuthModal.tsx`). | Margins pinch inputs on small screens (320px - 360px). | Mobile full-width card / bottom sheet with numeric keypad support for OTPs and autofill support. | 320px – 768px |

---

## 2. Trading & Market Data Views Audit

| Page / Component | Current Desktop Behavior | Mobile Problem (< 768px) | Required Mobile UX Solution | Target Viewports |
|---|---|---|---|---|
| **Option Chain (`OptionChainView.tsx`)** | Large 16-column table (Calls: OI, Chg, Vol, IV, LTP, Strike, Puts: LTP, IV, Vol, Chg, OI). | Horizontal scrolling breaks mobile layout; tiny click targets for strike prices. | **Mobile Option Chain Architecture**: Compact 3-column sticky strike view (Calls LTP / Strike / Puts LTP) + segment toggles (Calls vs Puts / OI / IV) + Expiry Dropdown & ITM/ATM/OTM quick filters + Bottom Sheet for strike details and Buy/Sell tickets. | 320px – 768px |
| **Watchlist (`GrowwWatchlistView.tsx`)** | Desktop tabular view with symbol, sparkline, LTP, change, and action buttons. | Table columns overflow screen width; action buttons cramped. | Mobile Card List view: Symbol + Exchange tag on left, LTP + Change % stacked on right, tap card to open Instrument Bottom Sheet or Swipe left/right for Quick Buy/Sell. | 320px – 768px |
| **Trading Terminal (`GrowwTerminalView.tsx`)** | 3-column layout: Left Watchlist, Center Interactive Chart, Right Order Panel. | 3 columns squished into 320px width; unusable charts and forms. | Mobile Segmented Layout: View switches between Chart tab, Depth tab, Option Chain tab, and persistent bottom BUY/SELL floating buttons triggering Bottom Sheet Order Ticket. | 320px – 768px |
| **Market Depth (`MarketDepthView.tsx`)** | 5-level bid/ask table side-by-side with total bid/ask volume bars. | Side-by-side tables overflow 320px width. | Stacked or compact split view: Top 5 Bids (Green) & Bottom 5 Asks (Red) with percentage visual depth bars. | 320px – 480px |

---

## 3. Portfolio & Ledger Audit

| Page / Component | Current Desktop Behavior | Mobile Problem (< 768px) | Required Mobile UX Solution | Target Viewports |
|---|---|---|---|---|
| **Positions (`OrdersPositionsView.tsx`)** | Wide table with 8 columns (Symbol, Product, Net Qty, Avg Price, LTP, Unrealized P&L, Realized P&L, Actions). | Requires horizontal scrolling; hard to read total P&L on mobile. | Mobile Position Cards: Sticky top P&L Summary Card (Day P&L, Total P&L, Net Investment) + Expandable Position Cards with 1-tap Square Off / Add Qty bottom actions. | 320px – 768px |
| **Orders Book (`OrdersPositionsView.tsx`)** | 11-column table showing Order ID, Symbol, Exchange, Side, Qty, Type, Product, Price, Status, Time, Action. | Table unreadable on mobile; cancel order button misaligned. | Mobile Order Cards: Segmented filter tabs (All, Open, Executed, Cancelled, Rejected) + Card list with color-coded side badges (BUY/SELL) + tap card for execution details & 1-tap Cancel button. | 320px – 768px |
| **Holdings (`GrowwHoldingsView.tsx`)** | Tabular overview of equity holdings, invested vs current value. | Table columns wrap awkwardly. | Mobile Holding Cards: Total Portfolio Return banner + scannable cards with symbol, qty, avg price, current value, and live return %. | 320px – 768px |

---

## 4. Admin Control Center Audit

| Page / Component | Current Desktop Behavior | Mobile Problem (< 768px) | Required Mobile UX Solution | Target Viewports |
|---|---|---|---|---|
| **Admin Dashboard (`AdminPanel.tsx` & `admin/*`)** | Wide multi-tab desktop dashboard (Users, Risk, Funds, System Monitor, KYC, Audit). | Desktop side menu and multi-column analytics charts unreadable. | **Mobile Admin Architecture**: Compact top KPI Stat Grid + Mobile Segmented Pill Bar + Card-based User Management, Risk Controls, Fund Approval Sheets, and System Health Monitor. | 320px – 1024px |
| **Customer 360 & KYC Queue (`Customer360.tsx`, `KYCQueue.tsx`)** | Wide tables showing user accounts, risk limits, virtual balances, and documents. | Action buttons and document images overflow. | Mobile Customer Cards + Full-width Document Approval Bottom Sheet with 1-tap Approve/Reject and Fund Adjustment sliders. | 320px – 768px |

---

## 5. Responsive Design Tokens & Breakpoint Specification

```css
/* Breakpoint Constants */
--mobile-xs: 320px;   /* Small phones (iPhone SE) */
--mobile-sm: 360px;   /* Standard Android */
--mobile-md: 390px;   /* Modern iPhone */
--mobile-lg: 430px;   /* Max phones (iPhone Pro Max) */
--tablet-sm: 768px;   /* iPad Mini / Portrait Tablet */
--tablet-lg: 1024px;  /* iPad Pro / Landscape Tablet */
--desktop: 1280px+;   /* Desktop Terminal */
```
