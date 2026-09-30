# Design Brief: TradeGrow Client Panel Redesign

## Problem

Retail traders using TradeGrow are handing over real deposited money to a simulated-execution platform — trust and clarity have to be earned visually, the same way a real broker earns it. Today the experience undercuts that: F&O, the platform's core product, has a category tab that visibly does nothing when clicked. Profile, KYC, and security settings exist in two different places (a full page and a separate modal) that have quietly drifted apart — different tabs, different information, one of them ignoring the user's own light/dark preference. Desktop and mobile are two independently maintained apps stitched together by a screen-width check, so a fix or a feature on one side routinely doesn't exist on the other. And because there's no real navigation — no URLs — nothing can be bookmarked, shared with support, or reached with the browser back button; every session starts from zero.

## Solution

One responsive React application — not a desktop app and a mobile app glued together — with real URLs for every page, so the browser back button, bookmarks, and shared links all work the way they do on any serious financial product. Every screen is built from a shared set of primitives (buttons, cards, tables, badges, dialogs) instead of each page hand-rolling its own, so fixing something once fixes it everywhere. Profile, KYC, bank details, security, and support converge into a single page instead of two drifting implementations. F&O gets the real, dedicated view its role in the product demands.

## Experience Principles

1. **One truth, every width** — the same component renders correctly from a 375px phone to a 1440px desktop; there is no separate "mobile version" of a feature to fall out of sync.
2. **Confidence over cleverness** — a trading interface's job is to make the user certain of what will happen when they tap "Buy," not to impress with motion or density; clarity wins every close call.
3. **Every screen has an address** — if a user can see it, they can link to it, bookmark it, and get back to it with the back button.

## Aesthetic Direction

- **Philosophy**: Clean modern fintech — Groww/Zerodha/Upstox register. Light-first, generous whitespace, restrained color used only where it carries meaning (gains, losses, calls, puts, alerts), not as decoration.
- **Tone**: Calm and authoritative. A trader placing an order under time pressure should feel the interface is precise and unhurried, never flashy or game-like.
- **Reference points**: Groww, Zerodha Kite, Upstox — light, minimal chrome, confident typography, quiet data density.
- **Anti-references**: Bloomberg-terminal density, dark-mode-only "hacker" fintech aesthetics, gradient-heavy AI-generated-looking dashboards, anything that reads as a game or a casino.

## Existing Patterns (audited from the live codebase — extend, do not replace)

- **Typography**: Inter (body/UI), JetBrains Mono (numeric/mono data) — both already loaded via Google Fonts in `index.css:1`. Tailwind config also declares Geist/Space Grotesk roles that are effectively unused; the redesign standardizes on the Inter + JetBrains Mono pairing already active and drops the unused font declarations rather than loading a third family.
- **Colors**: A genuinely solid token system already exists in `client/src/index.css` under `:root` (light) and `[data-theme="dark"]`/`.dark` (dark) — `--primary` (#16a34a, Groww green), `--gain`/`--loss` (#16a34a / #dc2626), dedicated `--call-accent`/`--put-accent` for options, `--bg-body`/`--bg-surface`/`--text-main`/`--text-muted`/`--border-color`, `--shadow-sm..xl`, `--radius-sm..full`. This is the target system — the redesign's job is to make every component actually use these variables (many currently hardcode raw `slate-900`/`text-white` Tailwind classes instead, which is why `index.css` has grown a block of `!important` overrides to force them into line under light theme — those overrides go away once components use the tokens directly).
- **Spacing**: `--space-xs` (2px) through `--space-3xl` (28px), already commented "Mobile Density Optimized" — keep this scale, it's appropriately tight for a data-dense trading UI.
- **Components**: No shared primitives layer exists (`components/` is 27 flat files, each hand-rolling its own buttons/cards/badges). `lucide-react` (icons) and `clsx` (className composition) are already dependencies and are the right tools to build primitives on top of — no new icon or styling library needed.
- **Dependencies available but unused for this**: none of react-router-dom, framer-motion, or any component-primitive library (shadcn/radix) are installed yet — routing needs to be added; animation should default to CSS transitions using the existing token scale rather than adding a motion library, unless a specific interaction genuinely needs one.

## Component Inventory

| Component | Status | Notes |
|---|---|---|
| `components/ui/Button` | New | Variants: primary, secondary, ghost, destructive, icon-only. Replaces ad-hoc buttons across all 27+ view files. |
| `components/ui/Card` | New | Replaces the existing `.tg-card`/`.glass-card` CSS-class pattern with a real component; keeps the same visual tokens. |
| `components/ui/Badge` | New | Status pills (gain/loss/pending/settled/tier severity) — currently hand-coded per-page. |
| `components/ui/DataTable` | New | Table with a built-in mobile fallback (stacked-card view below a breakpoint) — replaces the current pattern of wrapping raw `<table>` in `overflow-x-auto`/`overflow-hidden` with no mobile treatment (found broken in `OrdersPositionsView.tsx` and `admin/CustomerList.tsx`). |
| `components/ui/Dialog` / `Sheet` | New | Unifies the ~11 ad-hoc modal components into one dialog primitive (desktop centered dialog, mobile bottom sheet — same component, responsive behavior). |
| `components/ui/Tabs` | New | Used by the new unified Profile page and elsewhere; replaces hand-rolled tab-button rows. |
| `AppShell` (nav rail + top bar + bottom nav) | New | Single responsive shell replacing the parallel `GrowwHeader`/`GrowwSubNav` (desktop) vs `MobileBottomNav` (mobile) split — same shell renders a top nav rail on wide screens and a bottom tab bar on narrow ones. |
| Router / route table | New | `react-router-dom`, one route per page (`/`, `/watchlist`, `/positions`, `/orders`, `/holdings`, `/option-chain`, `/fo`, `/analytics`, `/profile`, `/admin/*`). |
| `ProfilePage` (unified) | Modify (merge) | Replaces both `ClientProfileView.tsx` and `UserProfileModal.tsx` — superset of tabs (Profile, KYC, Bank, Security, Funds, Support, Permissions, Appearance), theme-aware throughout. |
| F&O view | New | Currently a dead pill that changes nothing; needs a real dedicated view (leverages existing `OptionChainView`/derivatives components as building blocks rather than starting from zero). |
| `GrowwExploreView`, `GrowwWatchlistView`, `OrdersPositionsView`, `GrowwHoldingsView`, `OptionChainView`, `PortfolioAnalyticsView` | Modify | Rebuilt on the new primitives, made genuinely responsive (no separate mobile component), given real routes. |
| `MobileHomeView`, `MobileWatchlistView`, `MobilePortfolioView`, `MobileProfileView`, `MobileOrderModal` | Remove (superseded) | Functionality folds into the unified responsive components above; these files are deleted once their responsive replacements exist, not kept as a parallel path. |
| `MobileChartModal` | Kept, not removed | _Corrected during the dead-code-removal task: this plan originally called for folding it into a unified responsive chart view, but no task in this redesign ever built one (charting stayed out of scope) — deleting it would have broken the live mobile "tap a watchlist row to view its chart" feature, which nothing else replaces. Left in place; its BUY/SELL callback bug was fixed separately during the Order placement flow task._ |
| Dead states: `FO`-as-no-op, `MUTUAL_FUNDS` category, mobile `PORTFOLIO`/`ORDERS` tabs | Remove | Confirmed unreachable/no-op in the current build; cleaned up as part of the same pass rather than carried forward. |
| `PortfolioAnalyticsView` nav entry | Modify | Gets a real primary-nav entry (route + nav item) instead of being buried one level deep in a profile dropdown. |

## Key Interactions

- **Navigating anywhere** updates the URL; refreshing the page, using the back button, or sharing the link returns the user to the same view and (where meaningful) the same sub-state (e.g. `/positions?tab=open`).
- **Placing an order**: preview → confirm → optimistic pending state → settled/failed state, using the same `Dialog`/`Sheet` primitive and the same visual language on phone and desktop (currently two separate implementations: `OrderPreviewModal` vs `MobileOrderModal`).
- **Switching theme** (light/dark toggle) instantly re-themes every surface, including the areas that currently hardcode dark classes and silently ignore the toggle (the old `ClientProfileView`).
- **Resizing the window / rotating the device**: layout reflows fluidly (nav rail collapses to bottom tabs, tables collapse to stacked cards) — no full component-tree remount at a fixed pixel boundary, unlike the current `window.innerWidth < 768` swap.

## Responsive Behavior

- **Breakpoints**: mobile `<640px`, tablet `640–1024px`, desktop `>1024px` — introducing a real tablet layout where today there is only a binary mobile/desktop swap.
- **Navigation shell**: bottom tab bar (mobile + tablet portrait) vs. left nav rail (desktop) — one `AppShell` component, not two apps.
- **Tables** (positions, orders, holdings, admin customer list): collapse to stacked cards below `md`, not just a horizontally-scrolling shrunk table.
- **Touch targets**: minimum 44×44px on any interactive element below `md` (the existing `MobileBottomNav` already does this correctly — carry that standard to every other component, including admin).
- **Admin panel**: gets the same responsive shell treatment as the client panel (it's already reachable from a mobile tab today but several admin pages, e.g. `CustomerList`, currently clip content with no mobile-safe fallback).

## Accessibility Requirements

- WCAG AA contrast minimum for all text/background pairs in both themes (spot-check the option chain's call/put accent colors specifically, since they carry meaning beyond decoration).
- Full keyboard navigation: every interactive element reachable and operable via Tab/Enter/Space/Escape, including the new `Dialog`/`Sheet` (focus trap + return-focus-on-close) and `DataTable` row actions.
- Visible focus states on every focusable element (buttons, links, form inputs, table rows with actions) — not just a browser default outline that may be suppressed elsewhere in the current CSS.
- Screen-reader labeling for icon-only buttons and status badges (gain/loss/pending etc. must not rely on color alone).

## Out of Scope

- Any backend/API contract changes — this is a frontend-only redesign; existing endpoints and data shapes are treated as fixed.
- Building a real Mutual Funds feature — the category is being removed as dead weight (no backend support exists), not implemented.
- The admin panel's specific page-by-page redesign — covered by its own brief once the client panel is built (per the agreed client-first, admin-second order), though the shared primitives/`AppShell`/routing/tokens work built here is meant to be reused there directly, not rebuilt.
- Introducing a component-primitive dependency (shadcn/Radix) or animation library (framer-motion) — primitives are hand-built on existing `lucide-react`/`clsx`/Tailwind/CSS-variable stack to avoid new dependencies beyond `react-router-dom`.
- Payment/LinkPe gateway redesign beyond making its existing modal use the new `Dialog` primitive — its internal flow/copy is unchanged.
