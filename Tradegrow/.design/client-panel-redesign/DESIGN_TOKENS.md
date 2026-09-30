# Design Tokens: TradeGrow Client Panel

**Philosophy**: Clean modern fintech (Groww/Zerodha/Upstox register), per `DESIGN_BRIEF.md`. Light-first, calm, restrained color used only where it carries meaning.

**Approach**: extended, not replaced. The existing `client/src/index.css` token system was already solid — a genuinely well-built color/spacing/shadow/radius system with correct light/dark theming via `[data-theme]` + `.dark`/`.light` classes. This phase filled the real gaps (typography scale, motion tokens, warning/info status colors, overlay/focus tokens) and fixed one concrete bug (dead display-font declarations), rather than introducing a second, competing token vocabulary.

## What already existed (kept as-is)

- **Color**: `--bg-body/--bg-surface/--bg-surface-elevated/--bg-glass*`, `--text-main/--text-muted/--text-tertiary`, `--border-color/--border-light`, `--primary/--primary-hover/--primary-light/--primary-glow`, `--gain/--loss` (+ light variants), `--call-accent/--put-accent` (option chain), `--gogrow-blue` (secondary accent) — full light + dark + explicit-light palettes in `index.css:7-170`.
- **Spacing**: `--space-xs` (2px) through `--space-3xl` (28px), "Mobile Density Optimized" — kept exactly as-is for tables/rows/compact UI.
- **Elevation**: `--shadow-sm..xl`, theme-aware (softer/lighter in light mode, darker/more opaque in dark mode).
- **Radius**: `--radius-sm..full`.
- **Component-level utility classes**: `.glass-card`, `.glass-header`, `.tg-card`, `.tg-stat-card`, `.tg-pill-btn` — real, usable, theme-aware building blocks the new `components/ui/` primitives (Phase 6) can wrap rather than reinvent.
- **Motion (as one-off keyframes)**: price-flash, card-enter stagger, live-pulse, skeleton-shimmer, bottom-sheet slide-up — all already respect `prefers-reduced-motion` (`index.css:733-751`). Not touched; new semantic duration/easing tokens below are additive, existing animations can adopt them opportunistically as their components are rebuilt in Phase 6.

## What was added (`client/src/index.css`)

- **Typography scale** — did not exist as tokens at all (only `--font-main`/`--font-mono` family declarations existed; every size/weight/line-height in the app was ad hoc Tailwind defaults with no documented ramp). Added `--font-size-xs` (11px) through `--font-size-4xl` (38px), `--font-weight-normal/medium/semibold/bold` (400/500/600/700 — no heavier weights needed for UI text), `--line-height-tight/normal/relaxed` (1.2/1.5/1.7), `--letter-spacing-tight/normal/wide`.
- **Extended spacing** — `--space-4xl/5xl/6xl` (36/48/64px) added *above* the existing dense scale, for page-level section gaps and empty-state spacing, matching the brief's "generous whitespace" direction — the existing tight scale stays the default for data-dense contexts (tables, option chain rows).
- **Layout widths** — `--max-width-content` (640px), `--max-width-wide` (1120px), `--max-width-page` (1440px). Nothing like this existed; needed for the new `AppShell` (Phase 6) to have one documented answer to "how wide does the desktop layout get."
- **Motion tokens** — `--duration-instant/fast/normal/slow/slower` (50/150/250/400/600ms), `--easing-default/in/out/bounce`. Existing animations used inline magic numbers (0.2s, 0.35s, 0.4s, 1.2s, 1.8s scattered through keyframe/transition declarations) — new components (Dialog, Sheet, Button, Tabs) reference these instead of picking their own numbers.
- **Status colors beyond gain/loss** — `--warning`/`--warning-light` and `--info`/`--info-light` (aliased to the existing `--gogrow-blue`, deliberately not a third blue hue). Needed for the RMS reduce-only restriction banner and KYC pending/rejected states from the IA, which aren't naturally "gain" or "loss."
- **Overlay & focus (accessibility)** — `--overlay-backdrop` and `--shadow-focus`. Two things worth flagging:
  - **Real inconsistency found and resolved**: `.mobile-bottom-sheet-backdrop` (`rgba(2,6,23,0.75)`), `.sheet-backdrop-light` (`rgba(248,250,252,0.18)`), and `.sheet-backdrop-dark` (`rgba(2,6,23,0.22)`) each hardcoded a *different, disagreeing* backdrop value. `--overlay-backdrop` is now the one canonical value the new `Dialog`/`Sheet` primitive (Phase 6) uses; the old three classes are superseded once it ships, not deleted yet (still in use by current modals until they're rebuilt).
  - **No focus-ring token existed anywhere** — a real accessibility gap given the brief's "visible focus states on every focusable element" requirement. `--shadow-focus` (`0 0 0 3px var(--primary-glow)`) is the new standard, theme-aware since it rides on the existing `--primary-glow` token.

## Bug fixed in the same pass (`client/tailwind.config.js`)

`fontFamily.headline`/`.display`/`.label` pointed at `'Geist'`/`'Space Grotesk'` — neither font is loaded anywhere in the app (only Inter + JetBrains Mono are, via `index.css:1`). Confirmed via grep: **19 call sites across 8+ components** (`OrderPreviewModal`, `GrowwHeader`, `GrowwSubNav`, `IndexActionModal`, `UserProfileModal`, others) use `font-headline`/`font-label` — every one of them was silently rendering in the browser's generic fallback sans-serif instead of Inter. Fixed by repointing all four roles (`headline`/`display`/`body`/`label`) at the same loaded Inter stack and `mono` at JetBrains Mono only — role names unchanged, so no component needed to change, but headings across the app now actually render in Inter as intended. Also removed the `stitch`/`dark` legacy color palette from `tailwind.config.js` (confirmed zero usages via grep) — dead weight from what looks like an earlier, abandoned dark-IDE-style direction.

## Deviation from the skill's generic dark-mode template

The skill's template suggests a `@media (prefers-color-scheme: dark)` fallback alongside `[data-theme="dark"]`. This app doesn't have one, and deliberately isn't getting one here: theme is fully owned by explicit JS state (`App.tsx` sets `data-theme` + `.dark`/`.light` classes and persists the user's choice to `localStorage`), so the user's explicit toggle always wins and is always the source of truth — a system-preference media query would either never fire (redundant) or could contradict a persisted explicit choice on a fresh page paint before JS runs (worse). Extending the existing explicit-class-only model rather than layering in a parallel mechanism the app doesn't use.

## Shipped

Built and deployed (`docker compose build app && up -d`) — pure CSS/config addition plus the font-family fix, verified via a clean production build (`tsc && vite build`, no errors, CSS bundle 100.41→101.85 kB). No component behavior changed; the larger structural work (routing, `components/ui/` primitives, `AppShell`, responsive unification) is Phase 6.
