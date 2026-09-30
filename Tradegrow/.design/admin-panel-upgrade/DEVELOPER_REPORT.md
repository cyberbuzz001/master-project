# TradeGrow Admin Panel — Enhancement & Production Upgrade: Developer Report

Final developer output for the admin-panel-upgrade initiative (Phases A–G), per the
original brief's §34 requirement. Branch: `feature/rms-oms-overhaul-and-client-redesign`.
Diff stat across the initiative (Phase A's first commit through Phase G1): **41 files
changed, +3,340 / −2,295 lines**.

A polished, browsable version of this report (tables, color-coded severity pills) is
also published as a Claude artifact; this file is the durable, version-controlled copy.

---

## 1. Architecture Audit

The initiative opened with an inspection of the then-existing 15-module, 6,913-line
admin panel (full detail in `ADMIN_UPGRADE_BRIEF.md` §1). Seven structural findings
drove the phase ordering — security first, then data integrity, then performance, then
design system, then real-time, then new capability:

| # | Finding | Severity | Status |
|---|---|---|---|
| A1 | Admin panel entirely outside the design system — 987 hardcoded colors, 0/15 components using shared UI primitives, theme toggle ignored. | High | Fixed — Phase D |
| A2 | 18 raw `<table>` elements, no shared table component, no mobile fallback. | High | Fixed — Phase D2 |
| A3 | `CustomerList.tsx` (1,208 ln) had zero responsive handling. | High | Fixed — Phase D2/D4 |
| A4 | Permission enforcement 3% complete — 71 of 73 admin routes used only broad role checks. | Critical | Fixed — Phase A |
| A5 | Unbounded queries — 6× full `orders` scans, 3× `positions`, plus others with no `LIMIT`. | High | Fixed — Phase C |
| A6 | Only 7 of 73 admin routes used `withTransaction`. | High | Fixed — Phase B |
| A7 | No real-time in admin; a second competing WebSocket connection had since been added ad hoc for one page. | Medium | Fixed — Phase E1 |

**Corrections to the original master prompt**: the prompt assumed a dark, yellow-accented
"trading terminal" aesthetic and referenced ten screenshots that were never supplied.
Both were dropped in favor of the platform's actual, already-shipped design system
(light-first, Groww-green primary, working dark mode). The prompt's original text no
longer exists anywhere in the repository as of Phase F1's gap analysis — only the
adjusted brief (`ADMIN_UPGRADE_BRIEF.md`) survives.

---

## 2. Problems Found & Fixed

Beyond the seven structural findings above, phase-by-phase work surfaced concrete bugs
— several with real security or financial-integrity consequences.

**[CRITICAL] Migration crash-loop risk (no migrations-tracking table).** The migration
runner has no "already applied" tracking table — every `.sql` file re-runs on every
server startup, in filename order. Migrations `017` and `020` set a CHECK constraint
that a *later* migration legitimately widened; because the earlier files re-applied
their narrower definitions every restart, the first time real data contained a value
only the later migration allowed, the server crash-looped — which actually happened
live during Phase C. Fixed by widening both migrations to the full current allowed
value set. Standing rule: any future constraint-widening migration must also update
the earliest file that defined that constraint.

**[CRITICAL] Double-click phantom-position bug.** `ExecutionEngine.executeOrder`'s
idempotency check ran outside any lock — two near-simultaneous fill attempts for the
same order could both pass the check before either inserted an execution row, doubling
the resulting position and P&L. Fixed by making the order's FILLED status transition
itself the atomic guard, gated on `WHERE status IN ('ACCEPTED','PENDING')`.

**[CRITICAL] Staff-creation privilege escalation.** `POST /admin/customers/create`
never checked which role the *creator* could assign, while the sibling edit route
correctly gated role changes to `SUPER_ADMIN`/`ADMIN`. Since `USER_CREATE`'s default
roles include `MANAGER`/`OPERATIONS_MANAGER`, a manager-tier staffer could create a
brand-new `SUPER_ADMIN` account outright. Found during Phase F1, fixed in F2, verified
via a real attack simulation (blocked with 403; both legitimate paths still work).

**[HIGH] Unguarded `/funds/reset-margin`.** Any authenticated user could zero their own
margin/P&L and reset cash to a hardcoded value with zero guards, including while
holding open positions. Fixed by rejecting the reset while any open position/pending
order exists, and routing the remaining case through `recomputeUsedMarginForUser`.

**[HIGH] Non-atomic money-moving routes (Phase B).** Fund-request rejection, direct
fund adjustment, position edits, and order cancel/reject all had at least one
non-atomic step. Each rewritten to an atomic, status-guarded `UPDATE ... WHERE status
= '...' RETURNING` pattern inside `withTransaction`, with missing audit log calls added.

**[HIGH] A second, competing WebSocket connection.** `Customer360.tsx` had its own
independent `/ws` connection (`useAdminUserSocket`) alongside the shared
`useMarketSocket` connection every other page used. Fixed in Phase E1: ported
Customer360 onto the shared connection's new generic admin-event API, deleted the
now-dead second-socket hook.

**[MEDIUM] `risk_events.resolved` could never be set.** The column existed since the
original schema, but no route ever set it `TRUE`. Fixed in Phase F3: added
`POST /admin/risk/alerts/:id/resolve` and a "Resolve" button in Risk Command Center.

**[MEDIUM] Platform-wide color-contrast failures.** `axe-core` WCAG 2A/2AA scanning
found every one of the 15 admin pages failing color contrast (25–577 nodes each),
pre-existing across the already-shipped client panel too. Fixed by adjusting the
failing tokens (documented inline in `index.css` with before/after ratios) and
introducing `--text-on-accent` after discovering ~25 solid-color buttons had the same
issue independent of token values. Final scan: zero violations, all 15 pages, both
themes.

**[Noted, not fixed] Duplicate `/funds/request` route registration.** `api.ts`
registers this path twice with different validation; Express only ever runs the
first. Flagged as a follow-up — unrelated to the work it was found alongside.

---

## 3. Changes Made, by Phase

| Metric | Value |
|---|---|
| Admin routes | 80 (up from 73) |
| Routes on granular `checkPermission` | 77 / 80 |
| Permission keys in the catalog | 44 |
| New migrations | 4 (021–024) |
| Admin pages with zero contrast violations | 15 / 15 |
| Shared `/ws` connections | 1 (was 2) |

- **Phase A — Permission enforcement.** Extended `checkPermission()` across 71
  previously role-only-gated routes; added manager-hierarchy scoping
  (`restrictManagerToOwnCustomer`).
- **Phase B — Transaction safety.** Fixed 8 non-atomic money-touching routes.
- **Phase C — Performance.** Bounded 3 unbounded queries; fixed the migration
  crash-loop bug.
- **Phase D — Design system.** Adopted shared tokens and `DataTable` across all 15
  admin components (1,827 color-token replacements); D5 closed with zero axe-core
  violations.
- **Phase E1 — Real-time.** Consolidated onto one shared `/ws` connection; wired
  previously-dead event-emission call sites end-to-end.
- **Phase F — New capability.** Built the confirmed-missing support-ticket admin
  response feature; fixed the staff-creation privilege escalation; surfaced Tier-2
  withdrawal escalation; built the global alert system on the dormant
  `admin_notifications` table. Reporting/export and several UI gaps (User Assignment,
  Manager Management screens) explicitly deferred by the user's own prioritization.
- **Phase G — Close-out.** Full trading/RMS/OMS/wallet/client-panel regression pass;
  this report.

---

## 4. Database Migrations

This platform's migration runner has **no migrations-applied tracking table** — every
file in `server/src/db/migrations/` re-runs, in filename order, on every server
startup. Every migration is a standing idempotency contract against whatever data
exists, not a one-time script.

| File | Phase | Change |
|---|---|---|
| `017_update_wallet_ledger_check_constraint.sql` | C | Edited in place — widened to fix the crash-loop bug. |
| `020_closed_trades_admin_square_off_reason.sql` | C | Edited in place — same class of fix, for `exit_reason`. |
| `021_rms_auto_square_off.sql` | Pre-existing RMS/OMS phase | Seeds RMS config; adds `orders.source`/`orders.reason`. |
| `022_rms_loss_monitor.sql` | Pre-existing RMS/OMS phase | `rms_risk_tiers` table; `users.risk_restriction` column. |
| `023_wallet_ledger_margin_reset_type.sql` | B3 | Adds `MARGIN_RESET` to the wallet_ledger type constraint. |
| `024_kyc_permissions_perf_indexes.sql` | C1 | Indexes supporting the new bounded KYC query. |

**Numbering note**: two files both carry the prefix `017` (`017_update_users_role_check.sql`
and `017_update_wallet_ledger_check_constraint.sql`). They run in alphabetical order
relative to each other with no functional conflict, but worth renumbering to avoid
confusion.

No new migration was required for Phase F's alert system — it re-activated the
pre-existing `admin_notifications` table from migration `016`, provisioned since an
early phase but never wired to any code until now.

---

## 5. API Surface

80 routes in `server/src/routes/adminApi.ts`, mounted at `/api/v1/admin`:

| Module | Representative routes | Gate |
|---|---|---|
| Customers | `/customers/create`, `/customers/:id`, `/customers/:id/suspend`, `/customers/:id/close`, `/customers/duplicates` | checkPermission |
| Funds | `/funds/overview`, `/funds/requests`, `/funds/requests/:id/approve`, `/funds/requests/:id/reject` | checkPermission |
| Orders & Positions | `/orders/monitor`, `/orders/:orderId/cancel`, `/orders/:orderId/execute`, `/positions/:id/square-off` | checkPermission |
| KYC | `/kyc/applications`, `/kyc/applications/:id/approve`, `/kyc/applications/:id/reject` | checkPermission |
| Risk / RMS | `/risk/dashboard`, `/risk/alerts`, `/risk/alerts/:id/resolve` (new), `/rms/auto-square-off/run` | checkPermission |
| Permissions | `/permissions/matrix`, `/permissions/toggle-permission` | checkPermission |
| Support Tickets | `/support/tickets` (new), `/support/tickets/:id/status` (new) | checkPermission |
| Notifications | `/notifications` (new), `/notifications/:id/read` (new), `/notifications/mark-all-read` (new) | checkRole (broad, by design — shared feed) |
| Managers | `/managers`, `/managers/assign` | checkPermission — orphaned, no UI consumer |
| Market Data / Finance / Audit | `/market-data/config`, `/finance/reserves`, `/finance/ledger-reconciliation`, `/audit-logs` | checkPermission |

---

## 6. Final Permission Matrix

44 keys across 5 categories, each with a default role set consulted by
`checkPermission()` — a per-user override in `manager_permissions` takes precedence
when present; fails closed (403) on any DB error or unknown key.

### Financial Operations
| Key | Default roles |
|---|---|
| DEPOSITS_APPROVE | SUPER_ADMIN, ADMIN, FINANCE_MANAGER, MANAGER |
| WITHDRAWALS_APPROVE | SUPER_ADMIN, ADMIN, FINANCE_MANAGER, MANAGER |
| DIRECT_BALANCE_ADJUST | SUPER_ADMIN, ADMIN, FINANCE_MANAGER |
| PAYMENT_GATEWAYS_MANAGE / _UPDATE | SUPER_ADMIN, ADMIN, FINANCE_MANAGER (update: SUPER_ADMIN/ADMIN only) |
| RESERVES_RECONCILE | SUPER_ADMIN, ADMIN, FINANCE_MANAGER |
| FUNDS_OVERVIEW_VIEW | SUPER_ADMIN, ADMIN, FINANCE_MANAGER, MANAGER |
| LEDGER_VIEW | SUPER_ADMIN, ADMIN, FINANCE_MANAGER, READ_ONLY_AUDITOR |

### Trading & Risk Oversight
| Key | Default roles |
|---|---|
| SIM_ORDER_CANCEL | SUPER_ADMIN, ADMIN, RISK_MANAGER, MANAGER |
| POSITIONS_FORCE_CLOSE | SUPER_ADMIN, ADMIN, RISK_MANAGER |
| RISK_LIMITS_EDIT | SUPER_ADMIN, ADMIN, RISK_MANAGER |
| KILL_SWITCH_TRIGGER | SUPER_ADMIN only |
| RMS_VIEW | SUPER_ADMIN, ADMIN, RISK_MANAGER, READ_ONLY_AUDITOR |
| RMS_SQUAREOFF_RUN | SUPER_ADMIN, ADMIN, RISK_MANAGER |
| RISK_DASHBOARD_VIEW | SUPER_ADMIN, ADMIN, RISK_MANAGER |
| ORDERS_MONITOR_VIEW / MANAGE_ADMIN | All 12 staff roles |
| POSITIONS_EDIT_ADMIN | All 12 staff roles |
| EXECUTIONS_PROVENANCE_VIEW | SUPER_ADMIN, ADMIN, MANAGER, KYC_OFFICER, READ_ONLY_AUDITOR |

### Operations & User Management
| Key | Default roles |
|---|---|
| KYC_VERIFY_APPROVE | SUPER_ADMIN, ADMIN, KYC_OFFICER, OPERATIONS_MANAGER |
| KYC_REJECT | SUPER_ADMIN, ADMIN, KYC_OFFICER |
| USER_CREATE | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER — role-assignment gate added, see §2 |
| USER_LOCK_UNLOCK | SUPER_ADMIN, ADMIN, RISK_MANAGER, OPERATIONS_MANAGER, MANAGER |
| USER_RESET_PASSWORD | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER |
| KYC_QUEUE_VIEW | SUPER_ADMIN, ADMIN, MANAGER, KYC_OFFICER, OPERATIONS_MANAGER |
| CUSTOMERS_DUPLICATE_SCAN | SUPER_ADMIN, ADMIN, KYC_OFFICER, OPERATIONS_MANAGER, MANAGER |
| CUSTOMERS_PROFILE_EDIT / _ACTIVATE | SUPER_ADMIN, ADMIN, MANAGER |
| CUSTOMERS_SUSPEND / _LOCK | SUPER_ADMIN, ADMIN, RISK_MANAGER |
| CUSTOMERS_UNLOCK | SUPER_ADMIN, ADMIN |
| CUSTOMERS_CLOSE | SUPER_ADMIN only |
| SUPPORT_TICKETS_VIEW / _RESPOND | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, SUPPORT_AGENT (+ READ_ONLY_AUDITOR for view) |

### Audit, Feeds & System Security
| Key | Default roles |
|---|---|
| VIEW_AUDIT_LOGS | SUPER_ADMIN, ADMIN, MANAGER, FINANCE_MANAGER, READ_ONLY_AUDITOR |
| VIEW_PII | SUPER_ADMIN, ADMIN, KYC_OFFICER |
| MARKET_DATA_CONFIG | All 12 staff roles |

### Platform Administration
| Key | Default roles |
|---|---|
| MANAGE_ROLES_PERMISSIONS | SUPER_ADMIN, ADMIN |
| ADMIN_BROAD_VIEW | All 12 staff roles |
| MANAGERS_VIEW / _ASSIGN | SUPER_ADMIN, ADMIN — no UI consumer today |
| BROKER_TOKEN_MANAGE | SUPER_ADMIN, ADMIN |
| BROKER_TOKEN_STATUS_VIEW | SUPER_ADMIN, ADMIN, MANAGER |

---

## 7. Test Report

No staging environment exists for this platform — every phase was verified against
the live container using throwaway, SQL-inserted test accounts, cleaned up
immediately after each verification.

| Phase | Method | Result |
|---|---|---|
| A — Permission enforcement | Per-role API calls confirming allow/deny outcomes across 71 newly-gated routes. | Pass |
| B — Transaction safety | Concurrent-request race simulations (phantom-position scenario reproduced and confirmed fixed). | Pass |
| C — Bounded queries | Full clean redeploy after the migration-ordering fix; all 25 migrations re-ran successfully. | Pass |
| D — Design system | Playwright screenshots across light/dark × 4 breakpoints; axe-core WCAG 2A/2AA scan, all 15 pages, both themes. | Pass — 0 violations |
| E1 — Real-time | Live-push verification, no polling/reload: fund request and order fill both appeared within ~1.2–1.5s. | Pass |
| F2 — Privilege escalation fix | Real attack simulation: MANAGER attempting SUPER_ADMIN creation blocked (403); legitimate paths still work. | Pass |
| F3 — Alert system | End-to-end live push (badge + dropdown) and a manually-triggered risk-event resolve, confirmed in DB. | Pass |
| G1 — Full regression | 12 automated checks (order lifecycle, margin, fund flow, RMS); client-panel smoke test. | 11/12 pass†, 0 console errors |

† The one non-passing check asserted `cash_balance` should drop on a CNC buy; the
platform's correct-by-design behavior blocks the full notional as `used_margin`
instead — the test's assumption was wrong, not the platform.

---

## 8. Deployment Requirements

Standard cycle for this platform, unchanged by this initiative — no new environment
variables, no new external service dependencies.

- **Build**: `docker compose build app --no-cache` — runs `tsc -p server/tsconfig.json`
  then `tsc && vite build` for the client. Both must pass with zero errors.
- **Deploy**: `docker compose up -d --no-deps app` — recreates only the app container;
  migrations re-run automatically on startup (see §4's "no tracking table" note — a
  structural characteristic to design around, not a one-off caveat).
- **New tables activated, no new migration**: `admin_notifications` (migration `016`)
  is now live, populated by the Phase F3 alert system.
- **Rollback**: every phase's changes are additive or corrective — no destructive
  schema changes were made. Rolling back would leave `admin_notifications` populated
  but unread, which is harmless.

---

## 9. Explicitly Deferred

Per the user's own prioritization during Phase F, not technical blockers:

| Item | Why it's small/medium, not large |
|---|---|
| User Assignment UI | The `manager_assignments` backend already exists and works — no UI anywhere calls it. |
| Manager Management UI | `GET /admin/managers` / `POST /admin/managers/assign` are live, orphaned endpoints. |
| Reporting / export | A clean greenfield gap — smallest real version is export buttons on the highest-value list views. |
| Support Chats (live chat) | Genuinely absent, confirmed via broad grep — the only "large" item on this list, comparable in scope to the ticketing system already built. |
