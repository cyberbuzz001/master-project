# TradeGrow Platform — User & Employee Comprehensive Operating Guide

**Platform:** TradeGrow Ecosystem (`tradegrow.in`)  
**Core Stack:** Node.js/TypeScript, Express, PostgreSQL, DhanHQ Broker APIs, WebSocket feeds.  
**Audience:** TradeGrow Retail Users, Operations Staff, Customer Support, and Advisory Integration Teams.

---

## Table of Contents
1. [Overview & Core Mission](#1-overview--core-mission)
2. [Absolute Data Separation & Security Architecture](#2-data-separation--security-architecture)
3. [User Demat Onboarding & e-KYC Journey](#3-user-demat-onboarding--e-kyc-journey)
4. [Wallet Ledgers & Deposit/Withdrawal Operations](#4-wallet-ledgers--depositwithdrawal-operations)
5. [DhanHQ Broker Integration & Algorithmic Order Routing](#5-dhanhq-broker-integration--algorithmic-order-routing)
6. [Advisory Signal Sync & Automated Execution](#6-advisory-signal-sync--automated-execution)
7. [Risk Management System (RMS) & Stop-Loss Discipline](#7-risk-management-system-rms--stop-loss-discipline)
8. [Employee & Support Operating Runbook](#8-employee--support-operating-runbook)

---

## 1. Overview & Core Mission
TradeGrow is a next-generation Demat account management, smart trade execution, and algorithmic order routing platform designed for Indian equity, derivative (F&O), and commodity traders. It connects retail traders with institutional-grade risk controls and automated signal execution.

---

## 2. Absolute Data Separation & Security Architecture

> [!IMPORTANT]
> **Strict Isolation Between TradeGrow Demat Engine and Advisory CRM**
> - TradeGrow Demat accounts, client ledgers, trading credentials, and funds reside in a dedicated, cryptographically isolated database environment (`Tradegrow/`).
> - No administrative or maintenance task performed in the advisory CRM (`expert-advisory/`) can alter, modify, or delete any TradeGrow Demat user accounts, balances, or trade records.
> - Client Demat funds remain held at SEBI-registered custodian clearing corporations at all times.

---

## 3. User Demat Onboarding & e-KYC Journey

### Step-by-Step User Flow:
1. **Registration:**
   - User signs up with verified mobile number and OTP.
   - Sets secure PIN and biometrics (Face ID / Fingerprint on mobile).
2. **Instant e-KYC:**
   - PAN verification with instant NSDL / Income Tax API handshake.
   - Digilocker / Aadhaar OTP verification for instant address verification.
   - Bank Account verification via instant penny-drop (IMPS name verification).
3. **Demat Account Activation:**
   - Account UCC (Unique Client Code) assigned.
   - CDSL / NSDL depository mapping completed.

---

## 4. Wallet Ledgers & Deposit/Withdrawal Operations
- **Instant Deposits:** Handled via UPI autopay and NetBanking through segregated clearing accounts.
- **Ledger Verification:** Every credit and debit is recorded in an immutable double-entry ledger with automated UTR reconciliation.
- **T+1 Settlement:** Equity delivery sales are settled according to standard SEBI T+1 settlement cycles; F&O profits are credited after end-of-day clearing.

---

## 5. DhanHQ Broker Integration & Algorithmic Order Routing
TradeGrow interfaces directly with DhanHQ's high-speed trading APIs for sub-millisecond order execution:
- **API Authentication:** Secure OAuth token rotation and encrypted session credentials.
- **Supported Order Types:**
  - `LIMIT` & `MARKET` orders.
  - `STOP_LOSS` (`SL-L`) and `STOP_LOSS_MARKET` (`SL-M`).
  - Bracket Orders (`BO`) with predefined target and trailing stop-loss.
- **WebSockets:** Live tick-by-tick market depth for Nifty 50, Bank Nifty, and MCX commodities.

---

## 6. Advisory Signal Sync & Automated Execution
How TradeGrow integrates with Expert Stocks research advisory:
1. **Signal Dispatch:** When an Expert Stocks Research Analyst publishes a trade setup (e.g., *BUY BANKNIFTY 48500 CE @ 240, SL: 200, TGT: 320*), the signal is published to the secure API webhook.
2. **User Notification:** Client receives an instant push alert and WhatsApp signal.
3. **1-Click Execution:** The user can tap **Execute Trade**, and TradeGrow automatically computes position size based on their configured risk tolerance and places the order via their connected Demat account.
4. **Position Tracking:** The trade outcome, trailing stops, and profit taking are monitored continuously by the TradeGrow Risk Engine.

---

## 7. Risk Management System (RMS) & Stop-Loss Discipline
TradeGrow enforces strict client protection safeguards:
- **Maximum Daily Loss Limit (Kill-Switch):** If a user's daily losses exceed their self-set threshold (e.g. 5% of trading capital), trading is automatically paused for the day.
- **Auto Square-Off:** Intraday MIS positions are squared off automatically at 03:15 PM IST.
- **Margin Protection:** Orders are rejected if available margin falls below 110% of exchange requirement.

---

## 8. Employee & Support Operating Runbook

### Handling Common User Inquiries:
1. **"My Demat e-KYC is pending verification":**
   - Check Digilocker response status. If name mismatch occurs between PAN and Bank account, prompt user to submit bank passbook / cancelled cheque copy.
2. **"My order was rejected with Insufficient Funds":**
   - Verify SPAN + Exposure margin requirements for the contract. Explain peak margin regulations.
3. **"How do I link my Expert Stocks advisory subscription?":**
   - Navigate to **Profile -> Services -> Link Advisory Account**, enter the Client Code from Expert Stocks (`EXP-XXXX`), and verify via OTP.
