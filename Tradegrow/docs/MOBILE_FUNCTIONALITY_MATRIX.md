# Mobile Functionality Parity Matrix

This document tracks functional parity between Desktop and Mobile platforms to guarantee 100% feature preservation across authentication, market data, order execution, RMS, portfolio tracking, and admin controls.

| Feature Area | Desktop Function | Mobile Support | Mobile Implementation Mechanism | Parity Status |
|---|---|---|---|---|
| **Auth & Profile** | Login / Signup / 2FA / Session Refresh | Yes | `AuthModal.tsx` & `MobileProfileView.tsx` with OTP numeric input & token refresh | ✅ 100% |
| **Market Data** | Live WebSocket Ticks (NSE/BSE/NFO/MCX) | Yes | Shared `useMarketSocket.ts` hook with rAF batching and multi-key indexing | ✅ 100% |
| **Search & Discovery** | Global Instrument Search (Stocks, Indices, F&O) | Yes | `GlobalSearchModal.tsx` full-screen mobile search drawer with exchange pills | ✅ 100% |
| **Watchlist** | Multi-symbol Watchlist & Sparklines | Yes | `GrowwWatchlistView.tsx` & `MobileHomeView.tsx` with mobile list cards & swipe actions | ✅ 100% |
| **Trading Terminal** | Interactive Chart + Market Depth + Order Entry | Yes | `GrowwTerminalView.tsx` with responsive tabs & floating Bottom Sheet Order Ticket | ✅ 100% |
| **Option Chain** | 16-col Option Chain with IV, Greeks, OI, Strikes | Yes | `OptionChainView.tsx` responsive mobile view with sticky strikes & strike detail sheet | ✅ 100% |
| **Order Placement** | Market, Limit, SL, SL-M, MIS/CNC/NRML, Margin check | Yes | `OrderPreviewModal.tsx` & `MobileOrderModal.tsx` bottom sheets with margin preview | ✅ 100% |
| **Positions** | Real-time Net Qty, Avg Price, Live LTP & P&L, Square Off | Yes | `OrdersPositionsView.tsx` & `MobilePortfolioView.tsx` cards with 1-tap square-off | ✅ 100% |
| **Holdings** | Demat Holdings, Total Value, Total Return | Yes | `GrowwHoldingsView.tsx` & `MobilePortfolioView.tsx` mobile holdings list | ✅ 100% |
| **Orders Book** | Open, Executed, Cancelled, Rejected filter & Cancel | Yes | `OrdersPositionsView.tsx` mobile segmented cards & 1-tap cancel button | ✅ 100% |
| **Virtual Margin/Wallet**| Virtual Wallet balance, used margin, margin block | Yes | Shared `VirtualWalletLedger` backend & live wallet bar on header/drawer | ✅ 100% |
| **Customer Support** | Ticket creation, Chat support modal | Yes | `CustomerSupportModal.tsx` mobile full-height sheet | ✅ 100% |
| **Admin Panel** | Risk CommandCenter, KYC Queue, Fund Approval, Users, Health | Yes | `AdminPanel.tsx` mobile responsive grid & card view for administrative staff | ✅ 100% |
