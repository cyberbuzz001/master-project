---
name: Obsidian Terminal
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#bec7d4'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#88919d'
  outline-variant: '#3f4852'
  surface-tint: '#98cbff'
  primary: '#98cbff'
  on-primary: '#003354'
  primary-container: '#00a3ff'
  on-primary-container: '#00375a'
  inverse-primary: '#00629d'
  secondary: '#d3fbff'
  on-secondary: '#00363a'
  secondary-container: '#00eefc'
  on-secondary-container: '#00686f'
  tertiary: '#ffb77d'
  on-tertiary: '#4d2600'
  tertiary-container: '#eb8104'
  on-tertiary-container: '#522900'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#cfe5ff'
  primary-fixed-dim: '#98cbff'
  on-primary-fixed: '#001d33'
  on-primary-fixed-variant: '#004a77'
  secondary-fixed: '#7df4ff'
  secondary-fixed-dim: '#00dbe9'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#004f54'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  table-data:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.02em
  table-label:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
  compact-mono:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '400'
    lineHeight: 12px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 16px
  table-cell-padding: 6px 8px
  gutter: 1px
  sidebar-width: 280px
---

## Brand & Style
The design system is a high-performance, dark-mode-first environment tailored for professional options traders and institutional users. The brand personality is precise, authoritative, and low-latency. 

The aesthetic blends **Modern Corporate** with **Geist-inspired Minimalism**. It prioritizes information density and ocular comfort during long trading sessions. The interface uses a dark-onyx foundation with vibrant, high-contrast functional accents. Visual noise is eliminated to ensure that complex data—such as Greek variables and multi-leg strategies—remains the focal point.

## Colors
The color palette is built on a "Deep Obsidian" neutral scale. 

- **Primary:** A high-visibility blue used for active trade states and primary actions.
- **Surface Tiering:** 
  - `itm-surface`: A subtle blue-tinted elevation (Surface-High) to highlight In-The-Money options rows.
  - `otm-surface`: The base background color for Out-of-the-Money strikes.
- **Functional Greeks:** Specific desaturated neon tokens are assigned to Greek variables (Delta, Theta, Gamma, Vega) to allow traders to scan high-density tables without reading labels.
- **Order Book Depth:** Use 10% opacity fills of success/error colors for depth bars, ensuring text remains legible over the visualization.

## Typography
This design system utilizes **Geist** for UI controls and layout headers to maintain a sleek, modern professional feel. 

For all numerical data, price ladders, and Greek variables, **JetBrains Mono** is mandatory. This monospaced font ensures that decimals align perfectly in tables, preventing horizontal "jitter" when prices update rapidly. 
- Use `table-data` for standard strike prices and Greeks.
- Use `compact-mono` for micro-data like IV (Implied Volatility) or small bid/ask sizes.
- Ensure all numerical headings use `table-label` to provide clear hierarchy over the data.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy within a modular dashboard. The workspace is divided into "Panes" using 1px borders (hairlines) rather than wide gutters to maximize screen real estate.

- **Data Density:** Use a 4px base unit. 
- **The Option Chain:** Rows should have a fixed height of 32px to ensure high-density visibility of strikes.
- **Responsive Behavior:** On desktop, the layout is multi-pane. On tablet, panes collapse into a tabbed interface. This system is not intended for mobile-first use, prioritizing large-format data visualization.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and **Low-Contrast Outlines**.

- **Level 0 (Base):** #0A0A0A (Deepest black).
- **Level 1 (Card/Pane):** #0F0F0F (Slightly lighter, used for the main workspace).
- **Level 2 (In-the-Money Highlight):** #1A1D1E (Subtle blue-grey elevation).
- **Dividers:** Use #262626 for all hairlines.

Avoid shadows. Instead, use 1px solid borders to define the perimeter of active widgets. For overlays like tooltips or right-click menus, use a 70% blurred backdrop (Glassmorphism) with a #333333 border to separate from the underlying data.

## Shapes
The design system uses a **Soft** shape language. 

- **Containers/Panes:** 4px (0.25rem) radius for a sharp, professional look.
- **Interactive Elements:** Buttons and Input fields use 4px radius.
- **Status Indicators:** Pills (e.g., "Open Position" or "Working Order") use 2px radius or sharp corners to avoid a "consumer-app" aesthetic. 
The goal is to maintain a technical, instrument-like feel.

## Components
- **Option Chain Table:** The core component. ITM rows must use `itm-surface` background tokens. The "Strike" column should be centered and pinned.
- **Greek Display:** Values should be color-coded using the semantic Greek tokens (`delta`, `theta`, etc.) but only for the text color, never the background.
- **Order Book Depth Bars:** Horizontal bars behind the "Size" text. Green for Bids, Red for Asks. Bars should represent the relative volume at that price point compared to the top 10 levels.
- **Action Buttons:** Use "Ghost" style for secondary actions and "Solid" for "Buy/Sell". 
- **Input Fields:** Stepper-style inputs for Price and Quantity, optimized for rapid keyboard entry.
- **Trade Tickets:** A high-density summary of the current strategy (e.g., "Iron Condor") using compact typography and small status pips for each leg.