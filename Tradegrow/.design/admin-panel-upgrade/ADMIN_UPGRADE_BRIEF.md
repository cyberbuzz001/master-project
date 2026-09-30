# TradeGrow Admin Panel — Enhancement & Production Upgrade Brief

_Adjusted from the supplied master prompt. Every change to the original is listed in
§0 with the evidence that motivated it. Everything not listed there is carried
forward from the original prompt as written._

---

## §0. Corrections made to the supplied prompt

The original prompt was written against a different platform and a set of reference
screenshots that were not supplied. Five of its premises are factually wrong for this
codebase, and following them literally would damage work that already shipped.

### 0.1 — There are no reference screenshots (BLOCKING for §4–§13 of the original)

The original prompt maps ten modules to "IMAGE 1" … "IMAGE 10" and says "use the
uploaded screenshots as the visual reference." **No images were provided.** Those ten
sections have therefore been rewritten as functional specifications only — the
*requirements* in them (which are detailed and useful) are preserved in full; the
instruction to match an unseen visual is dropped rather than guessed at.

If you do have those screenshots, send them and I will reconcile the visual side
against them.

### 0.2 — The design language in the prompt contradicts this product

The prompt asks for:

> "Dark professional trading-terminal interface / Yellow/gold primary action color /
> Black/charcoal background"

That is not TradeGrow. `.design/client-panel-redesign/DESIGN_BRIEF.md` — the brief for
the 17-task client redesign completed immediately before this — specifies the opposite
and names the prompt's direction as an explicit **anti-reference**:

> "Light-first, generous whitespace, restrained color used only where it carries
> meaning" … Anti-references: "dark-mode-only 'hacker' fintech aesthetics"

The live token system is light-first with `--primary: #16a34a` (Groww green), with a
full dark theme available via the user's toggle.

**Adjusted:** the admin panel adopts the **existing TradeGrow token system and
`components/ui` primitives**, light-first with working dark mode — the same shell,
tokens, and components as the client panel. The prompt's *information-density* goals
(compact tables, dense-but-readable, minimal decoration, clear hierarchy) are kept in
full; only the colour/dark-only direction is overridden. Admin and client must not look
like two different products.

### 0.3 — "Frexever" is not this platform

The prompt says "Maintain the existing Frexever / Trade Grow style direction."
Frexever does not appear anywhere in this codebase. Treated as a copy-paste artifact
from the prompt's origin and dropped.

### 0.4 — Much of what the prompt says to "create" already exists

Verified by inspection (see §1). The prompt's framing of these as greenfield would have
produced duplicates of working systems:

| Prompt says "create" | Reality |
|---|---|
| Granular manager permissions (§8) | **Exists** — `manager_permissions` table, `permissionCatalog.ts`, `checkPermission()` middleware, and a working `PermissionsDashboard.tsx` UI |
| Audit log system (§15) | **Exists** — `logAuditAction()` used at 44 sites in `adminApi.ts`; `AuditLogViewer.tsx` UI |
| Financial ledger (§16) | **Exists** — `wallet_ledger` table + `LedgerViewer.tsx` |
| Deposit verification workflow (§11) | **Exists and is transactional** — `POST /funds/requests` wraps approval in `withTransaction`, guards on `status !== 'PENDING'`, and already has a duplicate-UTR check |
| RMS/risk integration (§17) | **Exists** — `RMS.ts`, `RmsLossMonitor`, `RmsAutoSquareOffEngine`, `risk_events`, `rms_risk_tiers`, `RiskCommandCenter.tsx` |
| Admin panel modules | **15 already built** (see §1.1) |

**Adjusted:** every such section is reframed from *create* to **audit → fix gaps →
extend**. The original prompt's own rule — "Do not delete working functionality without
first proving it is obsolete" — is retained and takes precedence.

### 0.5 — Scope must be phased, not delivered in one pass

34 sections spanning RBAC, finance, real-time, reporting, alerting, performance and
security is a multi-week program. The client redesign that just shipped was 17 tracked
tasks over many sessions. **Adjusted:** this brief ends in a phased task list
(`TASKS.md`), executed one task at a time with build → deploy → Playwright-verify →
report, matching the cadence already proven on this codebase.

---

## §1. Phase 1 — Architecture Audit (completed)

### 1.1 Current admin modules — 15 components, 6,913 lines

`AdminPanel.tsx` (194 ln) is a state-switch shell rendering:

| Section | Modules |
|---|---|
| Overview | AdminDashboard (264) |
| Operations | CustomerList (1208), Customer360 (1265), PermissionsDashboard (740), KYCQueue (217) |
| Trading | OrderMonitor (567) |
| Risk | RiskCommandCenter (206), KillSwitch (94) |
| Technology | MarketDataAdmin (705), BrokerHealth (81), SystemMonitor (55) |
| Finance | FundsDashboard (922), LinkPeAdminManagement (436), LedgerViewer (92) |
| Compliance | AuditLogViewer (61) |

### 1.2 Findings

| # | Finding | Evidence | Risk |
|---|---|---|---|
| **A1** | **Admin panel is entirely outside the design system.** 987 hardcoded `slate/zinc/gray` classes across 14 files; **0 of 15** components import `components/ui`. Ignores the theme toggle completely. | `grep` counts per file, §1.3 | High — the exact bug class the client redesign spent 17 tasks removing; admin and client now look like different products |
| **A2** | **18 raw `<table>` elements, none using `DataTable`.** | 9 files, `grep -c "<table"` | High — every table re-implements sorting/empty/loading; none get the mobile stacked-card fallback |
| **A3** | **`CustomerList.tsx` (1208 ln) has zero responsive handling** — 0 occurrences of `md:hidden`/`hidden md:`. | grep | High — already called out in `DESIGN_BRIEF.md` as clipping on mobile with no fallback |
| **A4** | **Permission enforcement is 3% complete.** 73 admin routes: **2** use `checkPermission()`, **71** use only broad `checkRole()`. The granular `manager_permissions` system is built, has a working UI, and is still almost entirely decorative. | `grep -c` on `adminApi.ts` | **Critical** — a `SUPPORT_AGENT` or `ANALYST` passes `checkRole(ADMIN_ROLES)` on ~71 privileged endpoints |
| **A5** | **Unbounded queries.** 6× `SELECT * FROM orders`, 3× `positions`, plus `wallet_ledger`, `risk_events`, `kyc_records`, `fund_requests` with no `LIMIT`. Only 14 pagination clauses across 73 routes. | grep | High — fails the prompt's own §19 target (1,000+ orders/positions) |
| **A6** | **Only 7 of 73 admin routes use `withTransaction`.** Deposit approval is correctly transactional; other money-touching paths need auditing individually. | grep | High until each money path is verified |
| **A7** | No real-time in admin — no WebSocket subscription; data is fetch-on-mount. | inspection | Medium |

### 1.3 Design-system drift, per file

```
207  Customer360.tsx        53  RiskCommandCenter.tsx
176  CustomerList.tsx       38  AdminDashboard.tsx
143  FundsDashboard.tsx     31  KYCQueue.tsx
110  PermissionsDashboard   23  LedgerViewer.tsx
105  OrderMonitor.tsx       15  AuditLogViewer.tsx
 64  LinkPeAdminManagement  14  BrokerHealth.tsx
                             7  KillSwitch.tsx / 1 SystemMonitor / 0 MarketDataAdmin
```

### 1.4 What is genuinely healthy

Not everything needs work, and the prompt's §31 ("do not break existing trading
functionality") applies:

- Deposit approval: transactional, status-guarded, duplicate-UTR-checked
- Audit logging: 44 call sites already wired
- RMS/OMS: overhauled in the immediately preceding engagement (margin unification, auto
  square-off, loss-tier monitor, scoped permissions) — **do not rewrite**
- `permissionCatalog.ts` + `checkPermission()`: correct, just barely applied

---

## §2. Priority order (revised from the prompt's §32)

The original prompt puts UI at Phase 4. Given A4, that is the wrong order — a
privilege-escalation hole outranks cosmetics.

1. **Security first (A4).** Extend `checkPermission()` across all 73 admin routes.
2. **Data integrity (A6).** Audit every money path for transactional safety + idempotency.
3. **Performance (A5).** Server-side pagination and bounded queries.
4. **Design system (A1/A2/A3).** Migrate admin onto `components/ui` + tokens + `AppShell`; kill the 18 raw tables.
5. **Real-time (A7).** Reuse the client panel's existing centralized socket, do not add a second one.
6. **New capability.** Only then: the modules from the original §5–§14 that genuinely don't exist.

## §3. Retained from the original prompt, unchanged

All of the following are carried forward verbatim in intent and remain binding:

- §2 inspect-before-modify; dependency map; don't delete working code unproven
- §8/§9 backend-enforced permissions — "frontend hiding alone is NOT security"
- §15 audit event schema (actor, target, prev/new value, IP, request ID, reason)
- §16 ledger-derived balances; manual adjustment requires permission + reason + audit
- §19 performance targets; §20 security controls
- §27 no mock data in production
- §29 atomic money operations with rollback
- §31 do not break existing trading functionality
- §33 acceptance criteria
- §34 required developer output (audit / problems / changes / migrations / API / permission matrix / test report / deployment)
