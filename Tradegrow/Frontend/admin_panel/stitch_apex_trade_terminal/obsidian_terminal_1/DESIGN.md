---
name: Obsidian Terminal
colors:
  surface: '#0c1323'
  surface-dim: '#0c1323'
  surface-bright: '#32394b'
  surface-container-lowest: '#070e1e'
  surface-container-low: '#141b2c'
  surface-container: '#191f30'
  surface-container-high: '#232a3b'
  surface-container-highest: '#2e3446'
  on-surface: '#dce2f9'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dce2f9'
  inverse-on-surface: '#293041'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb3ad'
  on-tertiary: '#68000a'
  tertiary-container: '#ff5451'
  on-tertiary-container: '#5c0008'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#0c1323'
  on-background: '#dce2f9'
  surface-variant: '#2e3446'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 16px
  gutter: 12px
  cell-padding-x: 8px
  cell-padding-y: 6px
---

## Brand & Style
The design system is engineered for high-stakes financial decision-making, evoking a sense of institutional-grade security and rapid execution. The aesthetic follows a **Modern Corporate** approach with **Glassmorphism** accents to provide depth without sacrificing the density required for a professional trading terminal. 

The interface prioritizes information density, using a dark-mode-first strategy to reduce eye strain during long trading sessions. Visual hierarchy is established through surface elevation and luminosity rather than vibrant color, ensuring that functional alerts (Buy/Sell signals) remain the focal point. The emotional response is one of calm control, precision, and sophistication.

## Colors
The palette is rooted in a "Deep Sea" spectrum to maintain a high-contrast environment for data visualization.

- **Primary (Electric Blue):** Used strictly for interactive states, selections, and primary actions. It represents the "system" layer.
- **Functional (Emerald & Rose):** These are the most high-chroma colors in the system, reserved for market movement (profit/loss) and directional actions (buy/sell).
- **Neutrals:** A tiered system of darks. `#0B1222` serves as the global canvas, while `#121826` and `#1E293B` define surface containers and structural borders.
- **Overlays:** Use semi-transparent variants of the neutral palette for glassmorphic effects, typically at 60-80% opacity with a 12px background blur.

## Typography
This design system utilizes **Inter** for all UI prose to ensure maximum legibility at small sizes. For numerical data, price tickers, and terminal outputs, **JetBrains Mono** is introduced to ensure tabular numerals align perfectly, facilitating quick scanning of price columns.

- **Scale:** Sizes are kept compact (primarily 13px and 14px) to maximize the "at-a-glance" data density.
- **Hierarchy:** Use weight (600 vs 400) and color (High-emphasis White vs Medium-emphasis Gray) rather than large size jumps to differentiate information.
- **Mobile:** For `display-lg` on mobile devices, scale down to 24px/32px to prevent wrapping on narrow porticos.

## Layout & Spacing
The layout follows a **Fluid Grid** model with high-density spacing. The base unit is **4px**, allowing for tight, precise alignment.

- **Terminal Layout:** On desktop, use a 12-column grid. Components like Order Books and Charts should be housed in "Panels" with 12px gutters.
- **Data Density:** Content should favor a "Compact" density. Tables use 6px vertical padding to ensure more rows are visible per screen height.
- **Breakpoints:**
  - **Mobile (< 600px):** Single column, stacked widgets, persistent bottom navigation for core actions (Watchlist, Portfolio, Orders).
  - **Tablet (600px - 1024px):** 2-column split-screen (Chart / Order Entry).
  - **Desktop (> 1024px):** Multi-pane dashboard with fixed sidebars and fluid central workspace.

## Elevation & Depth
Depth is signaled through **Tonal Layering** and **Subtle Outlines** rather than heavy shadows.

- **Level 0 (Canvas):** `#0B1222` - The base background.
- **Level 1 (Panels):** `#121826` with a 1px solid border of `#1E293B`.
- **Level 2 (Popovers/Modals):** `#1E293B` with a subtle 10% white inner stroke and a high-diffusion ambient shadow (Black, 40% opacity, 24px blur).
- **Glassmorphism:** Apply to navigation bars and floating action panels. Use a background blur of 12px and a fill of `#121826` at 70% opacity. This maintains the "premium" feel while keeping the UI feeling lightweight.

## Shapes
The shape language is **Soft** but disciplined. 

- **Components:** Standard buttons, input fields, and cards use a **4px (0.25rem)** radius. This maintains a technical, sharp-edged feel suitable for a professional tool.
- **Pills:** Status indicators (Online/Offline) and Chart tags use a fully rounded "Pill" shape to distinguish them from interactive buttons.
- **Interactive States:** Hover states should be indicated by a subtle increase in border luminosity or a background tint change, never a change in shape or size.

## Components
- **Buttons:** 
  - *Primary:* Solid Electric Blue (#3B82F6) with white text. 4px radius.
  - *Buy/Sell:* Emerald (#10B981) and Rose (#EF4444) backgrounds. Used for the final execution step.
  - *Ghost:* Transparent with `#1E293B` border for secondary actions.
- **Input Fields:** Dark background (#0B1222), 1px border (#1E293B). On focus, the border transitions to Electric Blue with a subtle 2px outer glow.
- **Data Tables:** 
  - Header: Label-caps font, background `#121826`.
  - Rows: Alternating zebra striping is discouraged; use subtle 1px bottom borders instead.
  - Cells: Use `data-mono` for all numerical values.
- **Status Indicators:** 
  - Small 6px circles with a "pulse" animation for real-time connectivity.
  - Use Emerald for "Connected," Amber for "Delayed," and Rose for "Disconnected."
- **Chips/Badges:** Small, low-contrast backgrounds with high-contrast text (e.g., a dark green background with light emerald text) to indicate order types (Limit, Market, SL).
- **Cards/Panels:** Defined by the Level 1 elevation rules. No heavy drop shadows; use the border color to define the perimeter.