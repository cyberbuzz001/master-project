# SECURITY_ARCHITECTURE.md — Brokerage Security, Authentication & Compliance

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech Security & Compliance Engineer  
**Status**: Production Specification (Version 1.0)

---

## 1. Multi-Layered Security Architecture

Trade Grow implements defense-in-depth across transport, gateway, application, database, and operational tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EDGE & TRANSPORT SECURITY                          │
│  - Mandatory TLS 1.3 / 1.2 with HSTS (max-age=31536000, preload)            │
│  - Strict Content Security Policy (CSP), Frameguard DENY, NoSniff           │
│  - IP-based and User-based sliding window rate limiters                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION & IDENTITY (JWT + Argon2id)               │
│  - Passwords hashed using Argon2id with cryptographically secure salts       │
│  - Short-lived Access Tokens (15 min) + Refresh Token Rotation (7 days)     │
│  - Role-Based Access Control (RBAC) with 11 granular permission roles       │
│  - Account Lockout after 5 failed attempts (LOCKED status)                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DATABASE & DATA PROTECTION SECURITY                     │
│  - No external exposure of PostgreSQL/Redis ports on public internet        │
│  - Parameterized SQL queries (zero string concatenation / SQLi prevention)  │
│  - Zero secrets in source code; strict environment validation at startup    │
│  - Immutable audit logs for all administrative and financial mutations     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Granular Role-Based Access Control (RBAC)

The system enforces 11 specialized administrative and trading roles:

| Role Code | Name | Permissions |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Super Administrator | Full platform control, risk settings, admin creation, database operations |
| **`ADMIN`** | Administrator | User management, KYC approval, funds adjustment, scrip master |
| **`RISK_MANAGER`** | Risk Officer | Kill-switch activation, RMS limit adjustments, position square-offs |
| **`FINANCE_MANAGER`**| Finance Officer | Deposit/withdrawal approvals, ledger audit, wallet reconciliation |
| **`KYC_OFFICER`** | Compliance Officer | KYC document review, ID verification |
| **`DEALER`** | Broker Dealer | Assisted order placement, client watchlists |
| **`USER`** | Standard Trader | Virtual order placement, portfolio views, wallet deposit requests |
| **`READ_ONLY_AUDITOR`**| Auditor | Read-only access to ledger, orders, trades, and compliance logs |

---

## 3. Strict Secrets Validation & Sanitization

At startup, `validateStartupEnvironment()` validates that:
* `JWT_SECRET` is set and has a minimum length of 32 characters.
* `JWT_REFRESH_SECRET` is set and valid.
* Database passwords and API keys are non-empty.

**Log Sanitization Rule**: Passwords, OTPs, JWT tokens, and KYC document raw buffers are **never** logged to stdout, files, or telemetry streams.
