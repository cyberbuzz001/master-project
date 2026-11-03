# TradeGrow Mobile Frontend Audit

Audit date: 2026-11-03

Scope: `Tradegrow/client`, with emphasis on mobile navigation, information hierarchy, touch interaction, responsive layout, accessibility, and PWA behavior.

## Executive summary

The mobile frontend has a strong foundation: a responsive shell, live index quotes, mobile-specific chart and terminal workspaces, safe-area padding, route-based navigation, and reusable UI primitives. The main usability problem was navigation density. The primary bottom bar exposed six destinations, plus a staff-only seventh item, while important secondary areas such as Option Chain and Profile competed for the same small touch surface.

The navigation has been simplified in the current working tree to five primary actions:

1. Home
2. Watchlist
3. Trade
4. Positions
5. More

Option Chain, Profile, Add Funds, and Admin are now grouped in a More bottom sheet. This reduces cognitive load and keeps the highest-frequency trading actions reachable with one thumb.

## Findings

### M-01 — Primary navigation was overcrowded — High

Evidence: `Tradegrow/client/src/components/AppShell.tsx` previously rendered Home, Watchlist, Terminal, Options, Positions, Profile, and optionally Admin in the bottom bar. Labels were 9.5px and each item had a narrow minimum width.

Impact: small targets, weak hierarchy, and inconsistent discoverability for staff versus regular users.

Change: reduced the primary bar to five actions and moved secondary destinations to the More sheet.

### M-02 — Bottom navigation required stronger safe-area and touch sizing — Medium

Evidence: the prior bar used `h-15` and compact controls. The stylesheet contained a 44px touch helper, but the nav item sizing was not consistently expressed as a clear 44px-plus target.

Change: primary items now use at least 48px height and 56px width, while the bar has explicit minimum height and safe-area padding.

### M-03 — Mobile content uses repeated hard-coded bottom padding — Medium

Evidence: `Tradegrow/client/src/App.tsx` repeats `pb-24` across many routes, while the navigation height and safe-area inset are defined separately in the shell.

Risk: future changes to the bottom bar can cause content to be hidden behind it or leave excessive empty space.

Recommendation: introduce one shared `--mobile-nav-offset` CSS variable or layout wrapper and use it for route content and fixed summary bars.

### M-04 — Terminal has a second mobile tab system — Medium

Evidence: `Tradegrow/client/src/components/GrowwTerminalView.tsx` has CHART, WATCHLIST, TRADE, and POSITIONS workspace tabs.

Recommendation: keep this local workspace navigation, but visually distinguish it from global navigation. Use a clear “Trade workspace” heading and ensure the active workspace is announced to assistive technology.

### M-05 — Option Chain is information-dense on small screens — Medium

Evidence: `Tradegrow/client/src/components/OptionChainView.tsx` renders separate desktop and mobile tables and relies on horizontal table presentation.

Recommendation: preserve the matrix for power users, but add a default compact contract card view on narrow screens with Strike, LTP, IV, OI, and Buy/Sell actions. Keep the full matrix behind an explicit “Full chain” toggle.

### M-06 — Accessibility is partially implemented but needs systematic verification — Medium

Positive evidence: semantic navigation, aria labels on several icon buttons, safe-area handling, reduced-motion rules, and touch-target helpers exist.

Gaps to verify: focus behavior for the More sheet, keyboard escape handling, visible focus states on all mobile actions, screen-reader announcements for live price updates, contrast in both themes, and 200% text scaling.

### M-07 — Mobile performance needs measurement — Medium

Evidence: the shell eagerly fetches four index quotes and subscribes to global index tokens; multiple views contain live data and animation behavior.

Recommendation: measure first-contentful paint, interaction latency, socket reconnect time, option-chain render duration, and memory usage on low-end Android devices. Virtualize long lists where the data set can grow.

## Recommended information architecture

| Priority | Destination | Access |
|---|---|---|
| 1 | Home | Bottom navigation |
| 2 | Watchlist | Bottom navigation |
| 3 | Trade | Bottom navigation; opens terminal workspace |
| 4 | Positions | Bottom navigation; positions is the default portfolio view |
| 5 | More | Bottom navigation; Option Chain, Profile, Funds, Admin |

## Verification plan

- Test at 320px, 360px, 390px, 412px, and 768px widths.
- Test iOS Safari standalone PWA and Android Chrome standalone PWA.
- Verify the bottom bar with safe-area insets and device rotation.
- Verify screen-reader names, active state, and focus order.
- Test navigation while a modal, quick order sheet, or keyboard is open.
- Run client TypeScript compilation and browser smoke tests after UI changes.

## Next improvements

1. Centralize mobile content offset and safe-area spacing.
2. Add an explicit compact Option Chain mode.
3. Add focus trap, Escape handling, and focus restoration to the More sheet.
4. Add mobile browser smoke tests for every primary tab.
5. Measure performance on low-end devices before adding more live widgets.
