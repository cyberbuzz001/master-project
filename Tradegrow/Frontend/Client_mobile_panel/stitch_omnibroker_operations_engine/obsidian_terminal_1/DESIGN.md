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
  on-surface-variant: '#c4c6d0'
  inverse-surface: '#dce2f9'
  inverse-on-surface: '#293041'
  outline: '#8e909a'
  outline-variant: '#44474f'
  surface-tint: '#adc6ff'
  primary: '#d8e2ff'
  on-primary: '#122f5f'
  primary-container: '#adc6ff'
  on-primary-container: '#385283'
  inverse-primary: '#455e90'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00b47d'
  on-secondary-container: '#003e28'
  tertiary: '#ffd9d4'
  on-tertiary: '#51221d'
  tertiary-container: '#feb3aa'
  on-tertiary-container: '#7a433c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#2c4677'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4ab'
  on-tertiary-fixed: '#360e0a'
  on-tertiary-fixed-variant: '#6c3832'
  background: '#0c1323'
  on-background: '#dce2f9'
  surface-variant: '#2e3446'
  surface-glass: rgba(18, 24, 38, 0.7)
  outline-technical: '#1E293B'
  execution-buy: '#4EDEA3'
  execution-sell: '#FFB4AB'
  status-pending: '#ADC6FF'
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
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 12px
  container-margin: 16px
  cell-padding-x: 8px
  cell-padding-y: 6px
---

## Brand & Style
Obsidian Terminal is an institutional-grade visual language engineered for high-frequency environments where precision and rapid decision-making are paramount. The brand personality is clinical, technical, and authoritative, evoking the feeling of a sophisticated trading floor or a command center.

The design style is a hybrid of **Glassmorphism** and **Brutalism**. It utilizes the layered transparency and backdrop blurs of glassmorphism to manage information density without losing spatial context, while employing the rigid, high-contrast grid structures and monospaced data displays characteristic of technical brutalism. The goal is to provide a "dark mode" interface that minimizes eye fatigue while using vibrant "Electric Blue" and "Execution Emerald" to highlight critical actions and data points.

## Colors
The palette is rooted in a deep "Canvas" neutral (#0C1323) to provide maximum contrast for functional colors. 

- **Primary (Electric Blue):** Used for branding, primary actions, and navigational focus. 
- **Secondary (Execution Emerald):** Reserved strictly for positive growth, "buy" actions, and "live" connectivity statuses.
- **Tertiary (Execution Coral):** Reserved for "sell" actions, "disconnected" states, and critical errors.
- **Surface Strategy:** Backgrounds use tonal layering. The base layer is `#0C1323`, while interactive panels use a semi-transparent glass effect (`rgba(18, 24, 38, 0.7)`) to create depth.

## Typography
The typography system prioritizes legibility and information hierarchy through distinct font roles:

- **Inter** is the workhorse font, used for all UI labels and headings. It provides a clean, neutral foundation.
- **JetBrains Mono** is utilized for all "Data" roles—prices, quantities, timestamps, and terminal logs. The monospaced nature ensures that numeric values do not jump visually when updating in real-time.
- **Label-Caps** are used for metadata and input headers to provide a clear distinction between structural information and user data.
- **Mobile Scaling:** `display-lg` should scale to 24px on mobile devices to prevent excessive wrapping.

## Layout & Spacing
The system uses a **12-column fluid grid** designed for high-density information display. 

- **Grid Logic:** Elements are arranged in a "Terminal Grid" with a consistent 12px gutter. This tight spacing maximizes screen real estate for data visualization.
- **Padding Strategy:** Panels use a standard 24px (6 units) internal padding for readability, while compact data cells use a 4px/8px rhythm.
- **Responsive Behavior:** On mobile, the 12-column grid collapses into a single-column stack. A fixed bottom navigation bar (64px height) replaces the top desktop navigation for easier thumb access.

## Elevation & Depth
Elevation is communicated through **Tonal Layering** and **Backdrop Blurs** rather than traditional drop shadows.

- **Level 0 (Canvas):** The base background (#0C1323).
- **Level 1 (Panels):** Glass-morphic panels with a `blur(12px)` and a 1px solid border (#1E293B). These are used for primary content containers.
- **Level 2 (Intervention):** High-contrast surfaces like tooltips or active dropdowns use the `surface-container-highest` hex (#2E3446).
- **Micro-shadows:** A very subtle `shadow-sm` is applied only to fixed headers to separate them from the scrolling content below.

## Shapes
The shape language is "Soft-Technical." Elements use a small, consistent corner radius to maintain a professional, utilitarian feel without appearing overly aggressive.

- **Standard Radius:** 4px (Default) for buttons and input fields.
- **Container Radius:** 8px (Large) for major glass panels and cards.
- **Utility Radius:** 12px (Extra Large) for interactive chips and badges to create a "pill" effect that distinguishes them from structural containers.

## Components
- **Buttons:** 
    - *Primary:* Solid Electric Blue (#ADC6FF) with dark text. 
    - *Execution:* Large vertical-stack buttons with secondary/tertiary backgrounds for Buy/Sell.
    - *Ghost:* 1px border with `outline-variant` and no fill.
- **Inputs:** Darkened background (#070E1E) with 1px `outline-variant` border. On focus, the border shifts to `primary` with a subtle glow.
- **Badges:** Low-opacity backgrounds (10%) with 20% opacity borders matching the label color. Used for order status (e.g., FILLED, PENDING).
- **Glass Panels:** The core container component. Must include `backdrop-filter: blur(12px)` and a subtle 1px border to ensure visibility against the dark background.
- **Connectivity Indicators:** Use a pulsing animation (`pulse-emerald`) for live network states to provide immediate visual feedback of system health.