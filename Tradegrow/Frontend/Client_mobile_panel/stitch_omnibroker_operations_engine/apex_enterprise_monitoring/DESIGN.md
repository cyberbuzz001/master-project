---
name: Apex Enterprise Monitoring
colors:
  surface: '#07122a'
  surface-dim: '#07122a'
  surface-bright: '#2f3952'
  surface-container-lowest: '#030d25'
  surface-container-low: '#101b33'
  surface-container: '#151f37'
  surface-container-high: '#1f2942'
  surface-container-highest: '#2a344e'
  on-surface: '#d9e2ff'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#d9e2ff'
  inverse-on-surface: '#263049'
  outline: '#8f9097'
  outline-variant: '#44474d'
  surface-tint: '#b9c7e4'
  primary: '#b9c7e4'
  on-primary: '#233148'
  primary-container: '#0a192f'
  on-primary-container: '#74829d'
  inverse-primary: '#515f78'
  secondary: '#b5c7ea'
  on-secondary: '#1e314c'
  secondary-container: '#354764'
  on-secondary-container: '#a3b6d8'
  tertiary: '#e7bf99'
  on-tertiary: '#432b10'
  tertiary-container: '#281400'
  on-tertiary-container: '#9d7b5a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#b9c7e4'
  on-primary-fixed: '#0d1c32'
  on-primary-fixed-variant: '#39475f'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#b5c7ea'
  on-secondary-fixed: '#071c36'
  on-secondary-fixed-variant: '#354764'
  tertiary-fixed: '#ffdcbd'
  tertiary-fixed-dim: '#e7bf99'
  on-tertiary-fixed: '#2b1701'
  on-tertiary-fixed-variant: '#5d4124'
  background: '#07122a'
  on-background: '#d9e2ff'
  surface-variant: '#2a344e'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
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
  margin-page: 24px
  density-compact: 4px
  density-default: 8px
---

## Brand & Style

This design system is engineered for high-stakes, high-density monitoring environments where speed of cognition is the primary metric. The brand personality is authoritative, precise, and unwavering. It utilizes a **Modern Corporate** style infused with **Technical Minimalism** to minimize "data ink" and maximize signal-to-noise ratios.

The emotional response should be one of absolute control and situational awareness. Every pixel serves a functional purpose, prioritizing legibility and status visibility over decorative elements. The interface remains quiet and dark to reduce eye strain during long-shift monitoring, allowing vibrant semantic status indicators to command immediate attention when anomalies occur.

## Colors

The palette is anchored by a deep navy core, providing a low-light foundation that prevents screen fatigue. 

- **Primary & Secondary:** Used for the background layers and structural containers. Primary (`#0a192f`) acts as the base canvas, while Secondary (`#172a45`) defines functional regions like sidebars or headers.
- **Semantic Status:** These are the most critical colors in the system. 
    - **Success:** A bright aquamarine for "All Systems Nominal."
    - **Warning:** A high-visibility amber for non-critical alerts.
    - **Error:** A vibrant red for immediate issues.
    - **Critical:** A deep, saturated magenta-red for catastrophic failures or system outages.
- **Data Visualization:** Use the neutral palette for non-critical data points and the `status_info` blue for connectivity or active state tracking.

## Typography

The typography system uses a dual-font strategy to balance hierarchy and data clarity.

- **Headlines (Hanken Grotesk):** Provides a clean, contemporary professional feel for dashboard titles and section headers. 
- **Data & Logs (JetBrains Mono):** The workhorse of the system. Monospaced characters ensure that numbers in ledgers and tickers align perfectly vertically, making it easier to scan for fluctuations in real-time.
- **Labels (Inter):** High-legibility sans-serif used for UI controls and secondary metadata.

For mobile views, `headline-lg` should scale down to 24px (`headline-md` equivalent) to preserve screen real estate for data tables.

## Layout & Spacing

This design system utilizes a **Fixed Grid** approach for primary dashboard layouts to ensure dashboard widgets remain in predictable locations for muscle memory. 

- **Grid:** 12-column layout with 12px gutters.
- **Density:** The system defaults to "Compact" density. Spacing between ledger rows and ticker items should rely on a 4px base unit. 
- **Reflow:** On tablet, the 12-column grid collapses to 6 columns. On mobile, widgets stack vertically into a single column, with the horizontal ticker converting to a vertical scroll list of key metrics.

## Elevation & Depth

To maintain high density without visual clutter, the system avoids shadows. Depth is communicated through **Tonal Layers** and **Low-contrast Outlines**:

- **Surface Level 0:** `#0a192f` (Main background).
- **Surface Level 1:** `#172a45` (Card backgrounds, sidebar).
- **Outlines:** Borders use 1px solid strokes at 10-15% opacity of the white foreground color.
- **Active States:** Subtle inner-glows (1px blur) using the semantic status colors are used to indicate an "Active" or "Alert" focus state on a specific widget or row.

## Shapes

The shape language is rigid and efficient. **Soft (0.25rem)** corners are used for standard interactive elements to provide just enough distinction from the background without wasting space. 

- **Data Cells:** 0px roundedness to ensure seamless edge-to-edge table appearance.
- **Status Badges:** Circular (full-round) for connectivity indicators; 2px rounded for status labels.
- **Buttons:** 4px (Soft) roundedness.

## Components

### Status Badges & Connectivity
- **Connectivity Dots:** 8px circles. Use `status_success` for "Connected" and `status_critical` for "Disconnected." Use a pulsing animation for "Connecting" (2s ease-in-out).
- **Status Tags:** Caps-label typography inside a background with 10% opacity of the semantic color and a 1px solid border of the 100% semantic color.

### Data Tables (Ledgers)
- **Rows:** 32px height for maximum density. 
- **Cell Alignment:** Numeric data must be right-aligned and monospaced.
- **Flash States:** When a value updates, the cell background should briefly flash (500ms) either `status_success` (for increase) or `status_error` (for decrease) at 20% opacity.

### Input Fields
- Dark backgrounds (`#0a192f`) with a 1px border. On focus, the border changes to `status_info` blue.

### Buttons
- **Primary:** Solid `secondary_color_hex` with white text.
- **Ghost:** Transparent background with 1px white-alpha border.
- **Alert:** Solid `status_error` for destructive or emergency actions.

### Real-time Tickers
- A horizontal strip at the top or bottom of the screen. Elements are separated by a 1px vertical divider. Use `body-sm` for the metric name and `data-mono` for the value.