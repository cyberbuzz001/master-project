# TradeGrow Unified Platform — Testing Strategy & Quality Assurance Matrix

**Document Reference**: `docs/testing/01_TESTING_STRATEGY.md`  
**Status**: APPROVED BASELINE (Phase 0)  

---

## 1. Testing Pyramid & Verification Gates

```
                 / \
                /   \     E2E User Journeys (Playwright)
               / E2E \    • 1-Click Advisory Order Flow
              /───────\   • Fee Calculator to KYC Onboarding
             /  Integ  \  Integration & Financial Tests (Jest / Supertest)
            /───────────\ • Double-Entry Ledger Reconciliation
           /    Unit     \• RMS Margin Calculations & Pre-Trade Checks
          /───────────────\ Unit Tests (Jest, PHPUnit, PyTest)
         /   Compliance    \• Prohibited Claim Linter & WCAG AA a11y
        /───────────────────\
```

---

## 2. Test Suites by Domain

### 2.1 Financial Math & Double-Entry Ledger Invariance Tests
* **Target**: `VirtualWalletLedger.ts` & `MarginMath.ts`
* **Test Criteria**:
  - `SUM(wallet_ledger.amount_paisa) == virtual_wallets.balance_paisa`: Zero variance across 10,000 concurrent mock transactions.
  - Floating point arithmetic is strictly barred; all balance mutations verified in integer paisa.
  - Rejection of negative buying power under volatile market scenarios.

### 2.2 SEBI Chinese Wall & Blackout Period Enforcement Tests
* **Target**: `RMS.ts` & `advisory.recommendations`
* **Test Criteria**:
  - Analysts attempting personal trade execution on covered stocks within `[T-30, T+5]` must trigger `SEBI_BLACKOUT_RESTRICTION` HTTP 403.
  - Recommendations cannot transition to `ACTIVE` without a verified `approver_id` signature from an authorized Research Head.

### 2.3 Regulatory Compliance & Prohibited Claim Linters
* **Target**: `apps/web-trust/build/build.js` & `check-a11y.js`
* **Test Criteria**:
  - CI fails immediately if terms like `"guaranteed returns"`, `"multibagger"`, `"100% safe"`, or `"zero tax"` appear in marketing copy without negation.
  - All interactive elements must pass WCAG 2.1 AA color contrast ratios (minimum 4.5:1 for normal text) and WAI-ARIA tab semantics.

### 2.4 High-Concurreny Load & Stress Testing (Phase 7)
* **Tooling**: k6 / Artillery
* **Target Metrics**:
  - 2,000 concurrent WebSocket connections receiving 100 ticks/second with client latency `< 50ms`.
  - 100 concurrent order submissions per second sustaining p99 response time `< 120ms` with zero race conditions on ledger balances.

---
*Testing strategy certified and saved to [01_TESTING_STRATEGY.md](file:///d:/2026%20C%20downloads/tradegrow%20app/docs/testing/01_TESTING_STRATEGY.md).*
