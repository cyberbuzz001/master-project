# Information Architecture: TradeGrow Client Panel

## Site Map

- Explore (Home) `/` — default landing page; market overview, indices, top movers, category-filterable
  - filtered by `?category=stocks|fo|commodities` (see URL Strategy)
- Watchlist `/watchlist`
  - filtered by `?category=stocks|fo|commodities`
- Option Chain `/option-chain`
- Portfolio `/portfolio` (redirects to `/portfolio/positions`)
  - Positions `/portfolio/positions`
  - Orders `/portfolio/orders`
  - Trade History `/portfolio/history` (added during Task 10 build — see note below)
  - Holdings `/portfolio/holdings`
  - Analytics `/portfolio/analytics`
- Profile `/profile` (redirects to `/profile/account`)
  - Account `/profile/account`
  - KYC `/profile/kyc`
  - Bank Details `/profile/bank`
  - Security `/profile/security`
  - Funds `/profile/funds`
  - Support `/profile/support`
  - Permissions `/profile/permissions` (staff only — hidden tab for non-staff)
  - Appearance `/profile/appearance`
- Admin `/admin/*` (staff only — separate brief/IA once client panel ships; routes reserved here so the shell/router work isn't redone)

## Navigation Model

- **Primary navigation** (max 5 items + Admin for staff): Explore, Watchlist, Option Chain, Portfolio, Profile. This is deliberately shallower than today's split bar — Positions/Orders/Holdings/Analytics consolidate under one "Portfolio" entry (as tabs) instead of each competing for a primary nav slot, since they're all facets of "what do I currently hold and what have I done," not independent destinations. One `AppShell` renders this as a top nav bar on desktop (matching the Groww/Zerodha/Upstox reference in the brief — corrected during Task 5 build from an earlier draft of this doc that called for a left rail, which didn't actually match any of the three named references) and a bottom tab bar on mobile/tablet-portrait — same 5(+1) items, same order, both places.
- **Secondary navigation**: tabs within a section (Portfolio's 5 tabs — grew from the originally-planned 4 once Task 10 found Trade History needed its own tab, see Content Hierarchy below — and Profile's 8 tabs) and the category filter (Stocks/F&O/Commodities) on Explore and Watchlist — a pill/segmented control, not a full nav level, since it filters content within the page rather than navigating to a different page.
- **Utility navigation**: theme toggle and the Profile entry point live in the top bar / shell chrome on every page, not inside primary nav itself — consistent with today's header pattern, just made theme-aware everywhere.
- **Mobile navigation**: bottom tab bar (same 5(+1) primary items), `min-h-[44px]` touch targets throughout (carrying forward the one thing the current `MobileBottomNav` already does well). Section tabs (Portfolio, Profile) render as a horizontally-scrollable pill row directly under the page header on narrow widths, matching the pattern `AdminPanel.tsx` already uses for its own mobile nav — reuse that pattern rather than inventing a second one.

## Content Hierarchy

### Explore (Home)
1. Category filter (Stocks / F&O / Commodities) — sets context for everything below it on the page
2. Index/market summary strip (Nifty, Sensex, Bank Nifty, or category-equivalent) — the fastest "how's the market doing" glance
3. Top movers / gainers-losers for the active category
4. Search/discover list of instruments — where the user actually finds something to act on

### Watchlist
1. Category filter (shared UI with Explore, same control)
2. The watchlist itself — symbol, LTP, day change, one-tap quick order action
3. Add/remove/reorder instruments — secondary, but frequent

### Portfolio → Positions
1. Open positions — net qty, average price, LTP, unrealized P&L, product type badge (MIS/NRML)
2. Per-position quick actions — square-off, modify, view chart
3. Aggregate summary (total unrealized P&L) — context for the list, not the headline

_Corrected during Task 11's build: this list originally included CNC in the product-type badge, contradicting this doc's own Naming Conventions table below ("Delivery equity ownership (CNC) → **Holdings** — never call this Positions"). The backend genuinely writes a CNC fill to both `positions` and a separate `holdings` row, so showing CNC here too would surface the same real position twice under two different tab names — exactly the kind of duplicate this whole redesign exists to remove. `OrdersPositionsView.tsx`'s Positions tab now filters CNC out; Holdings owns it exclusively._

### Portfolio → Orders
1. Pending/open orders — most actionable, needs to be scannable at a glance
2. Executed orders (today) — confirms what happened
3. Cancelled/rejected — lowest priority, still needed for trust ("why didn't my order go through")

### Portfolio → Trade History
_Added during Task 10's build, not in the original IA draft — found reading both source files that this doesn't fit inside Positions or Orders. A closed trade is a settled entry/exit pair with realized P&L and an exit reason (e.g. `RMS_AUTO_SQUARE_OFF`), a genuinely different shape from an open position (net qty/avg price/live LTP) or an order-book row (single order lifecycle record). The pre-merge mobile version tried to fold closed trades into the Positions list by filter, which required its row rendering to branch on two different data shapes — the pre-merge desktop version kept them as a separate tab, which is the cleaner design and the one this task adopted for both.
1. Exit time, instrument, entry→exit side, quantity, entry/exit price
2. Realized P&L — the headline number for this tab
3. Exit reason (MARKET_SQUARE_OFF, TARGET_LIMIT, RMS_AUTO_SQUARE_OFF, RMS_LOSS_SQUARE_OFF, etc.) — ties directly to the backend RMS work; this is the one place a user can see *why* a position closed, not just that it did._

### Portfolio → Holdings
1. Delivery (CNC) holdings — qty, average price, current value, P&L
2. Aggregate invested value vs current value

### Portfolio → Analytics
1. Overall portfolio P&L trend
2. Allocation breakdown (by instrument/category)
3. Risk-tier/margin-usage indicators (surfaces the same RMS risk-restriction state the backend now tracks — e.g. a REDUCE_ONLY banner if the account is currently restricted)

### Option Chain
1. Underlying selector + spot price — orientation
2. The chain itself (strikes, CE/PE, OI, IV, LTP) — the actual tool
3. Strike-click → order preview — the entire reason this page exists

### Profile → Account
1. Identity summary (name, client ID, phone/email)
2. Edit-profile actions

### Profile → KYC
1. Current KYC status (badge: pending/verified/rejected) — the one thing the user checks this tab for
2. Document upload/resubmission flow if not verified

## User Flows

### Place an order from the Option Chain
1. User lands on `/option-chain`, selects underlying
2. User taps a strike's CE or PE price
3. Order preview dialog opens (the unified `Dialog`/`Sheet` primitive) showing side, qty, product type, estimated margin
   - If margin insufficient → inline warning, disabled confirm, link to Profile → Funds
   - If account is `REDUCE_ONLY`-restricted and this order increases exposure → inline block with the RMS reason shown, matching the backend's actual rejection message
4. User confirms → optimistic "pending" state on the dialog → success (toast + dialog closes, position/order lists reflect it) or failure (inline error, dialog stays open)
5. User lands back on `/option-chain` exactly where they were (URL unchanged, no full remount)

### Check and act on a restricted/at-risk account
1. User's account crosses an RMS loss tier server-side (existing backend feature)
2. User opens the app — Portfolio → Analytics shows a risk-tier banner (new — see Content Hierarchy above) even before they open the specific position
3. User navigates to Portfolio → Positions, sees the affected position flagged
4. User attempts to reduce (square off) — allowed per RMS's own square-off exemption; attempts to open new exposure elsewhere — blocked, same message as the API returns

### Complete KYC
1. New/incomplete-KYC user is nudged (banner or badge) toward `/profile/kyc` from wherever they are
2. User uploads documents, submits
3. Status shows "Pending Review" (badge) — user can leave and return via the same URL, status persists visually
4. On approval/rejection (backend-driven), badge updates on next visit/poll; rejection shows the reason and a resubmit action inline, not a dead end

## Naming Conventions

| Concept | Label in UI | Notes |
|---|---|---|
| Intraday/derivative open exposure (MIS/NRML/F&O) | **Positions** | Never call this "Holdings" — financially distinct from delivery equity. |
| Delivery equity ownership (CNC) | **Holdings** | Never call this "Positions". |
| The record of placed/pending/executed/cancelled orders | **Orders** (or "Order Book" as a page subtitle, not the nav label) | Keep "Orders" as the single nav word. |
| Derivatives category (options + futures) | **F&O** | Not "Derivatives," not "Futures & Options" in nav (space) — spell out once in the category pill's tooltip/aria-label for accessibility. |
| The options-by-strike tool | **Option Chain** | Not "Options Chain" (current code already gets this right — keep it). |
| Deposited simulated capital | **Funds** | Matches the user-facing language `LinkPeAddFundsModal` originally used before Task 12 folded it (and two other independent deposit/withdrawal implementations) into `ProfilePage`'s Funds tab; backend table names (`virtual_wallets`) are irrelevant to UI copy. |
| The unified account/KYC/security page | **Profile** | Single word, single destination — no separate "Account Settings" label competing with it. |
| RMS-driven trading restriction state | **Restricted (Reduce-Only)** | Match the exact backend reason string where shown, so support and user see the same words. |

## Component Reuse Map

| Component | Used on | Behavior differences |
|---|---|---|
| `AppShell` (top nav bar + bottom tabs) | Every page, client and (later) admin | Top nav bar on desktop, bottom tabs on mobile/tablet-portrait — same component, responsive, not two shells. |
| `Tabs` | Portfolio (5 tabs), Profile (8 tabs), Option Chain underlying switch | Horizontally scrollable pill row on narrow widths (reuses the pattern already proven in `AdminPanel`'s mobile nav); Task 11 added a `scrollIntoView` effect once the Portfolio row grew past what a mobile viewport shows at once. |
| `DataTable` | Positions, Orders, Holdings, Watchlist, admin Customer List (later) | Stacked-card layout below `md`, full table above it — one component, one breakpoint rule everywhere it's used. |
| `Dialog`/`Sheet` | Order preview/placement, strike chart popover, add-funds, support contact | Centered dialog on desktop, bottom sheet on mobile — same trigger API, responsive presentation. |
| Category filter pill control | Explore, Watchlist | Identical control and state shape on both pages — literally the same component instance pattern, not two implementations. |

## Content Growth Plan

- **Watchlist**: user-controlled list, grows unbounded — needs client-side search/filter once past a handful of entries (not paginated; a watchlist is meant to stay fully scannable, so the real answer if it grows too large is prompting the user to curate, not infinite-scroll).
- **Orders/Positions history**: naturally time-bounded to "today" for the live tab; historical orders/trades get simple date-range filtering plus pagination once volume is high, not infinite scroll (financial records benefit from explicit, resettable pages over ambiguous scroll position).
- **Option Chain**: bounded by the exchange's own strike list per expiry — no growth-plan concern, just an expiry-date selector.

## URL Strategy

- **Pattern**: `/section` for primary destinations, `/section/sub-section` for tab-equivalent sub-pages (Portfolio, Profile), matching the "every screen has an address" principle from the brief.
- **Dynamic segments**: none required at the top level for the client panel (no per-instrument detail route in this phase — instrument detail opens as a `Dialog`/`Sheet` overlay on top of Explore/Watchlist/Option Chain rather than a separate page, keeping the "click a strike → order preview" flow fast). This can be revisited as `/instrument/:symbol` later if a shareable single-instrument page becomes a real need — explicitly out of scope for this pass.
- **Query parameters**: `?category=stocks|fo|commodities` on Explore and Watchlist (filters content within the same page rather than navigating elsewhere); pagination/date-range params on historical Orders/Holdings once needed (`?from=&to=&page=`).
