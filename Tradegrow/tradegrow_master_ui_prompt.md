# TradeGrow — Master UI/UX Overhaul Prompt (Client + Admin, Sequenced)

## GOAL
Elevate both the client-facing trading panel and the admin panel from
"functional" to "professional fintech product" — matching the polish of apps
like Zerodha Kite, Groww, or Upstox — while adding the operational depth an
admin team needs day to day. Both surfaces live in the same codebase
(`client/src`), so the design foundation in Phase 0 is built ONCE and used by
both. Work phase by phase, in order. Do not skip Phase 0.

## WORKING METHOD
- Approach every phase like a senior product/UI designer, not a feature
  checklist: consider visual hierarchy, spacing rhythm, color theory
  (financial data — gains/losses — carries real emotional weight), scan-
  ability, and cognitive load. Admin tools fail when visually noisy; trading
  apps fail when they feel untrustworthy or laggy.
- Build a real design-token layer (colors, spacing, radius, shadow,
  typography) once and reference it everywhere. No new hardcoded hex values,
  one-off shadows, or bespoke spacing introduced anywhere in this work, on
  either surface.
- Reuse shared components (DataTable, Dialog, Badge, Button, etc.) for any
  new UI — never hand-roll a one-off styled element when a shared component
  exists or should exist.
- Respect existing RBAC/permission gating on every new admin view. Never
  expose client financial or KYC data ungated.
- After each phase: self-critique against the rest of the app (spacing,
  alignment, color consistency, responsive/mobile behavior on both the
  client's mobile view and admin's mobile pill-bar nav) before moving on.
- Typecheck/build clean after every phase before starting the next.
- After each phase, summarize what changed and flag any judgment calls
  (exact thresholds, color values, animation timing, layout decisions) for
  review before continuing to the next phase.

═══════════════════════════════════════════════════════════════
## PHASE 0 — Shared design foundation [BOTH — do once, applies everywhere]
═══════════════════════════════════════════════════════════════
1. Audit every current shadow value, border-radius, spacing value, and color
   across both admin and client components. Consolidate into a single
   design-tokens file (CSS variables or Tailwind config extension):
   - One elevation scale (flat / raised / overlay / modal) used identically
     by every card, dropdown, and modal on both surfaces.
   - One spacing scale, one radius scale.
   - One P&L/status color system (a single green, a single red, and a
     consistent mapping for status pills — KYC, order, ticket, risk level)
     used everywhere — text, badges, chart lines, borders.
   - A typography scale with tabular/monospace numerals (or
     `font-variant-numeric: tabular-nums`) applied to every P&L, LTP, margin,
     and balance figure on both surfaces, so digits never cause column
     jitter as values update live.
2. Build a reusable skeleton-loader set (card, table-row, stat-tile) and
   replace every blank/flash-of-empty loading state — LTP, positions,
   margin, watchlist, admin tables — with the appropriate skeleton.
3. Build a live-tick micro-animation utility (brief ~200-300ms flash/pulse
   on value change) and wire it into every real-time numeric field on both
   surfaces: client LTP/P&L/margin, and any live-updating admin figures
   (Active Positions modal, dashboard KPIs).

═══════════════════════════════════════════════════════════════
## PHASE 1 — Client Home / Dashboard [CLIENT]
═══════════════════════════════════════════════════════════════
- Lead with today's P&L, open positions count, and available margin as
  primary above-the-fold content, not static account info.
- Add an "Action needed" strip that conditionally shows the highest-priority
  pending item (incomplete KYC step, low margin warning, SL/target about to
  trigger) — hidden entirely when nothing needs attention.
- Add a "Recent activity" feed (last 5-10 orders/trades) on Home.

═══════════════════════════════════════════════════════════════
## PHASE 2 — Admin daily-ops efficiency [ADMIN]
═══════════════════════════════════════════════════════════════
- Command palette (⌘K / Ctrl+K): jump to any customer by ID/name, any order,
  or any nav section without the mouse.
- Wire the existing global search to search customers + orders + tickets at
  once, results grouped by type.
- Customer quick-view hover card: hovering/tapping a client ID anywhere
  (Orders, Ledger, Tickets) shows a compact Customer 360 summary without a
  full navigation.

═══════════════════════════════════════════════════════════════
## PHASE 3 — Client high-impact fixes, part 1 [CLIENT]
═══════════════════════════════════════════════════════════════
- Auto-square-off countdown on open MIS positions (e.g. "Auto square-off at
  3:20 PM" with a live countdown) so closes are never a surprise.
- Order-rejection reason with a fix: show the specific reason inline (e.g.
  "Insufficient margin — need ₹X more") with a one-tap "Add Funds" CTA,
  never a bare "Rejected".

═══════════════════════════════════════════════════════════════
## PHASE 4 — Admin KYC Queue [ADMIN]
═══════════════════════════════════════════════════════════════
- Kanban-style pipeline (Pending → Under Review → Approved/Rejected).
- Bulk approve/reject for low-risk auto-flagged cases.
- SLA timer per pending item — red badge once pending >24h.

═══════════════════════════════════════════════════════════════
## PHASE 5 — Client Watchlist [CLIENT]
═══════════════════════════════════════════════════════════════
- Multiple watchlists with quick-switch tabs.
- Inline mini-sparkline per row.
- Drag-to-reorder (desktop) + swipe-to-remove (mobile).

═══════════════════════════════════════════════════════════════
## PHASE 6 — Admin Funds / Ledger [ADMIN]
═══════════════════════════════════════════════════════════════
- Reconciliation view: expected bank credits (UPI/QR deposit refs) vs actual
  ledger entries, flagging mismatches.
- CSV/PDF export on Ledger Viewer with date-range and client filters.
- Large-transaction alert feed (deposit/withdrawal over a configurable
  threshold pings admins in real time via the Phase 12 notification center).

═══════════════════════════════════════════════════════════════
## PHASE 7 — Client Options chain [CLIENT]
═══════════════════════════════════════════════════════════════
- Let users pin/expand strike range per session (currently resets from the
  ±5 default); remember last-used expiry across sessions.
- OI (open interest) change highlighting on strikes with unusual buildup.
- One-tap "buy/sell at LTP" alongside the full order modal.

═══════════════════════════════════════════════════════════════
## PHASE 8 — Admin Support Tickets / Live Chat [ADMIN]
═══════════════════════════════════════════════════════════════
- SLA breach highlighting (tickets open past X hours turn red).
- Canned/saved responses.
- Ticket-to-agent assignment + internal notes (never client-visible).
- Chat transfer between agents preserving full context.

═══════════════════════════════════════════════════════════════
## PHASE 9 — Client Positions & Orders, remaining [CLIENT]
═══════════════════════════════════════════════════════════════
- Inline SL/target modification directly from the position row (small
  pencil/edit icon) instead of the full modal for a one-field change.
- Order history with a clear status timeline: Placed → Triggered →
  Executed, or Placed → Rejected (reason always visible).

═══════════════════════════════════════════════════════════════
## PHASE 10 — Admin Order Monitor [ADMIN]
═══════════════════════════════════════════════════════════════
- Extend the existing single square-off (Active Positions modal) to
  multi-select bulk square-off.
- Anomaly flags: orders placed just before a known SL/target trigger, or
  unusually large size vs. that client's account history.

═══════════════════════════════════════════════════════════════
## PHASE 11 — Client Profile & Account [CLIENT]
═══════════════════════════════════════════════════════════════
- Segment into tabs: Personal Info, Bank/UPI, KYC Status, Security
  (password/2FA), Preferences.
- Visible KYC progress indicator ("3 of 4 steps complete").
- Security tab: "last login" panel (device, approximate location, time).

═══════════════════════════════════════════════════════════════
## PHASE 12 — Admin cross-cutting [ADMIN]
═══════════════════════════════════════════════════════════════
- Wire the notification bell to real events: new KYC submission, large
  withdrawal, support ticket SLA breach, risk kill-switch trigger — each
  deep-linking to the relevant record.
- "Recently viewed customers" (last 5), pinned near the top of Customers.
- "Your recent actions" panel — per-admin activity log distinct from Audit
  Logs, for self-review.

═══════════════════════════════════════════════════════════════
## PHASE 13 — Client Funds [CLIENT]
═══════════════════════════════════════════════════════════════
- Distinct "Available to withdraw" figure separate from "Available margin",
  with a short inline explainer of the difference.
- Deposit/withdrawal history with status (Processing/Success/Failed) and
  expected settlement time.
- Proactive margin-utilization warning (e.g. at 85%) before forced
  liquidation, not after.

═══════════════════════════════════════════════════════════════
## PHASE 14 — Admin Risk & Compliance [ADMIN]
═══════════════════════════════════════════════════════════════
- Per-client exposure/margin heatmap across all active traders.
- Automated risk score per client (leverage usage, loss streaks,
  order-cancel ratio) as a badge on Customer 360.
- Per-client circuit breaker (distinct from the global Kill Switch),
  auto-restricting a client when drawdown/exposure crosses a threshold.
- Suspicious-pattern detection (rapid order placement/cancellation,
  wash-trading-like behavior) flagged for compliance.
- Client segmentation/tagging (VIP, high-risk, new, dormant), filterable
  across Customers, Orders, and Funds.

═══════════════════════════════════════════════════════════════
## PHASE 15 — Client notifications & trust signals [CLIENT]
═══════════════════════════════════════════════════════════════
- Push/in-app alert the moment an SL or target actually triggers.
- Visible "connected/live" market-data indicator (mirroring admin's).

═══════════════════════════════════════════════════════════════
## PHASE 16 — Admin Broker Health / Technology [ADMIN]
═══════════════════════════════════════════════════════════════
- Historical uptime & latency chart for the Dhan feed/WebSocket.
- API rate-limit usage monitor with an early-warning threshold.
- "What's live" panel: current deployed git commit hash + deploy timestamp.
- Feature-flag toggle UI for enabling/disabling experimental features
  without a redeploy.

═══════════════════════════════════════════════════════════════
## PHASE 17 — Client ease of use / onboarding [CLIENT]
═══════════════════════════════════════════════════════════════
- First-time empty states with a clear CTA (e.g. empty Watchlist → "Add
  your first stock" with a search prompt).
- Contextual tooltip layer for options-specific terms (OI, IV, Greeks).
- Command/search shortcut parity with admin.

═══════════════════════════════════════════════════════════════
## PHASE 18 — Admin Financial Controls [ADMIN]
═══════════════════════════════════════════════════════════════
- Maker-checker withdrawal approval (second admin must approve withdrawals
  above a configurable amount).
- Configurable per-tier transaction limits.
- Rapid deposit-withdraw cycle alerts.

═══════════════════════════════════════════════════════════════
## PHASE 19 — Client high-impact fixes, part 2 [CLIENT]
═══════════════════════════════════════════════════════════════
- Floating "help" button on every screen, opening Live Chat/Support without
  navigating away (including mid-trade).
- Daily/monthly P&L calendar heatmap (GitHub-style, green/red by day).
- Support ticket status tracking for the client (Open → In Progress →
  Resolved).

═══════════════════════════════════════════════════════════════
## PHASE 20 — Admin Business Analytics [ADMIN]
═══════════════════════════════════════════════════════════════
- Client funnel: signup → KYC completed → funded → first trade → active.
- Dormant-client flag (no login/trade in N days).
- Daily/monthly brokerage revenue dashboard.
- Top gainers/losers leaderboard across clients.

═══════════════════════════════════════════════════════════════
## PHASE 21 — Admin Client Communication [ADMIN]
═══════════════════════════════════════════════════════════════
- Broadcast/announcement tool (in-app notification or banner to all clients
  or a filtered segment).
- Per-client communication log (emails/SMS/notifications sent) on
  Customer 360.

═══════════════════════════════════════════════════════════════
## PHASE 22 — Admin UI/UX polish [ADMIN]
═══════════════════════════════════════════════════════════════
- Drag-to-rearrange KPI cards on the Executive Dashboard, persisted per
  admin.
- Saved filter presets per admin (e.g. "my KYC review queue").
- Keyboard-shortcut cheatsheet overlay ("?" key), documenting the command
  palette and any other shortcuts introduced.

## DELIVERY
Work phase by phase, strictly in order — later phases assume the design
tokens, skeleton loaders, and shared components from Phase 0 already exist.
After each phase: confirm build/typecheck is clean, summarize the change,
and flag judgment calls for review before starting the next phase.
