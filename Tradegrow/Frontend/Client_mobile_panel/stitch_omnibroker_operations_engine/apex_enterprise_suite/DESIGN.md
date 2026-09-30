---
name: Apex Enterprise Suite
colors:
  surface: '#11131c'
  surface-dim: '#11131c'
  surface-bright: '#373943'
  surface-container-lowest: '#0c0e17'
  surface-container-low: '#191b25'
  surface-container: '#1d1f29'
  surface-container-high: '#282934'
  surface-container-highest: '#32343f'
  on-surface: '#e1e1ef'
  on-surface-variant: '#c3c5d9'
  inverse-surface: '#e1e1ef'
  inverse-on-surface: '#2e303a'
  outline: '#8d90a2'
  outline-variant: '#434656'
  surface-tint: '#b7c4ff'
  primary: '#b7c4ff'
  on-primary: '#002682'
  primary-container: '#0052ff'
  on-primary-container: '#dfe3ff'
  inverse-primary: '#004ced'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#ffb4a1'
  on-tertiary: '#611300'
  tertiary-container: '#bf3003'
  on-tertiary-container: '#ffddd5'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001452'
  on-primary-fixed-variant: '#0038b6'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbd2'
  tertiary-fixed-dim: '#ffb4a1'
  on-tertiary-fixed: '#3c0800'
  on-tertiary-fixed-variant: '#891e00'
  background: '#11131c'
  on-background: '#e1e1ef'
  surface-variant: '#32343f'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
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
  container-margin: 24px
  column-gutter: 12px
  data-density-compact: 4px
  data-density-comfortable: 12px
---

## Brand & Style

The design system is engineered for mission-critical financial operations where speed of comprehension and data integrity are paramount. The brand personality is **authoritative, precise, and high-performance**, catering to institutional traders, risk managers, and enterprise analysts.

The aesthetic follows a **Sleek Industrial** approach with subtle **Glassmorphic** accents. It prioritizes functional clarity over decorative elements, utilizing a structured grid that feels robust and engineered. Visual interest is generated through light-refracting borders, micro-interactions for real-time data updates, and a depth model that mimics high-end hardware interfaces. The UI must evoke a sense of absolute reliability and technical sophistication.

## Colors

This design system utilizes a specialized palette optimized for high-contrast monitoring environments. 

- **Primary:** An "Electric Cobalt" used sparingly for primary actions and focus states.
- **Surface Palette:** A deep "Midnight Blue" foundation with layered greys to define hierarchy.
- **Status Palette:** Non-negotiable semantic colors. Success (Emerald), Warning (Amber), and Critical (Rose) are used for real-time health indicators and financial delta changes.
- **Glass Accents:** Translucent layers are used for floating panels (command centers) to maintain visual context of the data layers beneath them.

## Typography

The system employs a multi-family typographic strategy to differentiate between intent and data type:

- **Headings (Hanken Grotesk):** Provides a contemporary, sharp enterprise feel for page titles and section headers.
- **Body & Interface (Inter):** Used for controls, settings, and general reading to ensure maximum legibility at small sizes.
- **Data & Metrics (JetBrains Mono):** Monospaced numerals are mandatory for all tabular data, price tickers, and WebSocket health logs to ensure vertical alignment of digits during rapid updates.

## Layout & Spacing

The design system utilizes a **12-column fluid grid** with condensed gutters to maximize screen real estate. 

- **Data Density:** The rhythm is based on a 4px baseline. Table rows and list items should offer a "Compact" toggle that reduces vertical padding to 4px, allowing more rows to be visible above the fold.
- **Command Center:** Widgets and sidebars should be anchored to the edges of the viewport with fixed widths (e.g., 320px) while the main data table remains fluid.
- **Breakpoints:** 
  - Desktop: 1440px+ (Standard viewing)
  - Ultra-wide: 1920px+ (Optimized for multi-chart dashboard views)
  - Mobile/Tablet: Focus on single-column KPI summaries; complex tables should transition to card-view or horizontal scroll.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Glassmorphism**, moving away from traditional drop shadows which can muddy high-density interfaces.

1. **Base Level:** Deepest background color (#020617).
2. **Floor Level:** Cards and table containers with a 1px solid border (#1E293B).
3. **Elevated Level:** Floating command widgets use a backdrop-filter (blur: 12px) and a semi-transparent fill.
4. **Interactive State:** Hovered items use a "Glow" effect—a subtle inner shadow or outer bloom using the Primary or Status color—to indicate focus without shifting layout.

## Shapes

To maintain the **Industrial** aesthetic, roundedness is kept minimal. 

- **Components:** Buttons, inputs, and tags use a 4px (Soft) radius to feel precise. 
- **Containers:** Large dashboard widgets and cards may use 8px (Large) to create distinct visual boundaries.
- **Indicators:** WebSocket health pings and status dots are strictly circular to contrast against the rigid rectangular grid.

## Components

### Real-Time Indicators
- **Pings:** Small circular indicators that "pulse" using a CSS scale animation when data is received via WebSocket.
- **Status Badges:** Pill-shaped with low-opacity backgrounds and high-contrast text.

### Data-Heavy Tables
- **Header:** Sticky headers with integrated multi-select, global search, and filter-chip overflow.
- **Cell Types:** Numeric cells must be right-aligned with monospaced fonts. Positive/negative deltas use color-coded text without backgrounds.
- **Filtering:** A slide-out "Filter Drawer" for complex boolean logic.

### KPI Cards with Sparklines
- **Sparklines:** Minimalist SVG lines (2px stroke) without axes, color-coded based on the trend (Success/Critical).
- **Primary Metric:** Large Hanken Grotesk weight for the current value, followed by a smaller percentage change.

### Command Center Widgets
- **Health Monitor:** A compact widget displaying latency (ms), WebSocket status (Connected/Reconnecting), and buffer usage.
- **Action Buttons:** Use "Ghost" style borders for secondary actions and "Solid Industrial" for primary execution (e.g., Buy/Sell/Deploy).

### Input Fields
- **Industrial Style:** Dark backgrounds with a bottom-only 2px border that glows when focused.