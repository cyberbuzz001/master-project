# TradeGrow Unified Platform — Security & RBAC Specification

**Document Reference**: `docs/security/01_SECURITY_AND_RBAC_SPECIFICATION.md`  
**Status**: APPROVED BASELINE (Phase 0)  
**Regulatory Standards**: SEBI (Research Analysts) Regulations 2014, SEBI Cybersecurity & Cyber Resilience Framework (CSCRF), DPDP Act 2023  

---

## 1. Role-Based Access Control (RBAC) Matrix

The unified platform manages eight distinct user roles with strict privilege segregation:

| Domain Permission | Retail Trader | Advisory Sub. | Research Analyst | Research Head | Compliance Officer | CRM Agent | Broker Admin | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `market.quotes.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `trading.orders.place` | ✅ | ✅ | ❌*(Restricted)* | ❌*(Restricted)* | ❌ | ❌ | ❌ | ❌ |
| `trading.portfolio.view` | ✅*(Own)* | ✅*(Own)* | ❌ | ❌ | ✅*(Audit)* | ❌ | ✅*(Audit)* | ✅ |
| `advisory.recs.view_active`| ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `advisory.recs.draft` | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `advisory.recs.approve` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `compliance.profile.manage`| ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| `compliance.audit_log.view`| ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| `crm.leads.view_assigned` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `crm.leads.assign` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `crm.calls.log` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `broker.rms.manage_limits` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `broker.square_off.trigger`| ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `system.settings.edit` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*(Restricted)*: Subject to automated SEBI Blackout Period validation.

---

## 2. SEBI Chinese Wall & Personal Trading Blackout Policy

In compliance with **Regulation 16 of the SEBI (Research Analysts) Regulations, 2014**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CHINESE WALL SEGREGATION ARCHITECTURE                    │
├──────────────────────────────────────┬──────────────────────────────────────┤
│          RESEARCH DIVISION           │           BROKERAGE / DEALING        │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Research Analysts & Research Head  │ • Dealing Desk & Trading Operations  │
│ • Draft recommendations & analysis   │ • Customer order execution & RMS     │
│ • Restricted from dealing activities │ • Strictly barred from pre-release   │
│ • No access to client order books    │   access to research recommendations │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 2.1 Automated Blackout Rule Enforcement
1. **Pre-Publication Freeze**: An analyst or research team member cannot trade in securities of a company they are researching for **30 calendar days** prior to publishing a recommendation.
2. **Post-Publication Freeze**: An analyst cannot trade in the recommended securities for **5 calendar days** following public dissemination of the research report.
3. **Automated Trading Intercept**: The order submission pipeline checks `core.users.role`. If the user is flagged as `RESEARCH_ANALYST` or `RESEARCH_HEAD`, the RMS queries `advisory.recommendations` for active blackout windows on the target symbol. If detected, the order is blocked with error `SEBI_BLACKOUT_RESTRICTION`.

---

## 3. Data Protection & Cryptographic Standards (DPDP Act 2023)

1. **PII Masking & Encryption**:
   - PAN, Aadhaar virtual tokens, and bank account numbers are encrypted in PostgreSQL using `AES-256-GCM` via pgcrypto.
   - Bank account numbers are masked (`XXXX-XXXX-1284`) across all client-facing and CRM agent interfaces.
2. **Password Security**:
   - Passwords must be hashed using **Argon2id** with parameters: `memoryCost: 65536 KB (64MB)`, `timeCost: 3 iterations`, `parallelism: 4 threads`.
3. **Multi-Factor Authentication (2FA)**:
   - Mandatory TOTP (RFC 6238) for all internal roles (`RESEARCH_ANALYST`, `RESEARCH_HEAD`, `COMPLIANCE_OFFICER`, `BROKER_ADMIN`, `SUPER_ADMIN`).
   - Time-step window: 30 seconds with ±1 window tolerance.
4. **Transport Layer Security**:
   - TLS 1.3 enforced across all public and internal service communications.
   - HSTS header with `max-age=31536000; includeSubDomains; preload`.

---

## 4. Rate Limiting & DDOS Defense Tiers

| Endpoint Category | Rate Limit (Tier) | Throttling Strategy |
| :--- | :--- | :--- |
| **Public Lead Submission** | 5 requests / min / IP | Cloudflare Turnstile + Redis sliding window |
| **User Login & 2FA Challenge**| 5 attempts / min / IP | Progressive backoff + Account lock after 5 failures |
| **Order Placement (`POST /orders`)**| 20 orders / sec / User | Token bucket algorithm in Redis (`Idempotency-Key` required)|
| **Market Data WS Subscriptions** | 100 symbols / User | Connection-level subscription rate gate |
| **CRM Telephony Webhook Ingestion**| 60 calls / min / Agent | Dedicated internal VPC IP allowlisting |

---
*Security and RBAC specification certified and saved to [01_SECURITY_AND_RBAC_SPECIFICATION.md](file:///d:/2026%20C%20downloads/tradegrow%20app/docs/security/01_SECURITY_AND_RBAC_SPECIFICATION.md).*
