---
name: Apex Enterprise
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#44474d'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#75777e'
  outline-variant: '#c5c6cd'
  surface-tint: '#515f78'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#0d1c32'
  on-primary-container: '#76849f'
  inverse-primary: '#b9c7e4'
  secondary: '#0050cc'
  on-secondary: '#ffffff'
  secondary-container: '#0266ff'
  on-secondary-container: '#f9f7ff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001e2d'
  on-tertiary-container: '#6a889b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#b9c7e4'
  on-primary-fixed: '#0d1c32'
  on-primary-fixed-variant: '#39475f'
  secondary-fixed: '#dae1ff'
  secondary-fixed-dim: '#b3c5ff'
  on-secondary-fixed: '#001849'
  on-secondary-fixed-variant: '#003fa4'
  tertiary-fixed: '#c8e7fd'
  tertiary-fixed-dim: '#accbe0'
  on-tertiary-fixed: '#001e2d'
  on-tertiary-fixed-variant: '#2c4a5c'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
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
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
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
  gutter: 16px
  table-cell-padding: 8px 12px
  sidebar-width: 260px
  sidebar-collapsed: 64px
---

## Brand & Style
The design system is engineered for the high-stakes environment of Indian FinTech brokerage. The brand personality is **authoritative, precise, and systematic**, designed to evoke a sense of absolute reliability and institutional trust. 

The visual direction follows a **Corporate / Modern** aesthetic with a heavy emphasis on information density and functional clarity. It prioritizes data integrity and rapid scanning over decorative elements. The style utilizes a structured "Layered Canvas" approach where the primary navigation resides on a deep institutional navy plane, while the main workspace uses high-contrast surfaces to ensure that financial figures and status indicators remain the focal point.

## Colors
The palette is rooted in a "Trust-First" methodology. 
- **Primary (Deep Navy):** Reserved for structural elements like the sidebar and primary headers to establish a baseline of authority.
- **Action (Vibrant Blue):** Used strictly for interactive elements, primary buttons, and active states to guide the user's eye toward workflows.
- **Semantic Palette:** Highly saturated tones are used for financial indicators (Profit/Loss, Buy/Sell, Compliance Status) to ensure quick cognitive processing of market movements and risk alerts.
- **Background Strategy:** A neutral off-white canvas (#F9FAFB) reduces eye strain during long trading hours, while pure white (#FFFFFF) is used for data containers to create a "lifted" effect for critical information.

## Typography
This design system utilizes **Inter** for its exceptional legibility in data-heavy interfaces. To handle complex financial reporting, the system employs **tabular numerals** (tnum) by default for all data tables, ensuring that columns of numbers align vertically for easier comparison.

- **Hierarchy:** Headlines are bold and slightly condensed in tracking to maintain a professional, news-like tone.
- **Data-Specific:** A specialized `data-mono` style is used for tickers, stock prices, and transaction IDs to prevent visual "jumping" when values update in real-time.
- **Mobile Scaling:** Large headlines scale down by 15% on mobile devices to preserve screen real estate for data tables.

## Layout & Spacing
The layout uses a **fixed-fluid hybrid grid**. The sidebar remains fixed at 260px (with a 64px collapsed state), while the main content area utilizes a 12-column fluid grid.

- **Density:** We utilize a tight 4px base unit. For an enterprise brokerage, "Compact" is the default. Padding in data tables is minimized to `8px 12px` to maximize the number of rows visible above the fold.
- **Breakpoints:**
  - **Desktop (1280px+):** Full sidebar, 24px margins.
  - **Tablet (768px - 1279px):** Collapsed sidebar, 16px margins.
  - **Mobile (0px - 767px):** Bottom navigation or hamburger menu, 12px margins, single-column KPI stacks.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and crisp, low-opacity shadows. Because the system is data-dense, heavy shadows are avoided to prevent visual "clutter."

- **Level 0 (Canvas):** #F9FAFB. Used for the global background.
- **Level 1 (Cards/Tables):** #FFFFFF. White surfaces with a 1px border (#E5E7EB) and a subtle 2px blur shadow at 5% opacity.
- **Level 2 (Popovers/Modals):** Pure white with a 12px blur shadow at 10% opacity.
- **Sidebar Depth:** The navigation uses a "Reverse Depth" approach—it is the darkest element in the UI, visually receding to allow the bright, data-filled cards to pop forward as the primary interaction layer.

## Shapes
The shape language is **Soft (0.25rem)**. This subtle rounding provides a modern touch without sacrificing the professional, "engineered" feel of a financial tool. 

- **Buttons & Inputs:** Use the standard 4px (0.25rem) radius.
- **KPI Cards:** Use 8px (0.5rem) to provide a distinct visual boundary from smaller UI components.
- **Status Pills:** Use a fully rounded (pill) shape to distinguish them from interactive buttons.

## Components
- **Data Tables:** The core component. Features include sticky headers, zebra-striping on hover, and inline "Maker-Checker" status tags. Numerical columns must be right-aligned.
- **KPI Cards:** Compact containers featuring a `headline-md` value, a `body-sm` label, and a miniature color-coded sparkline (Green/Red) indicating 24-hour trends.
- **Status Indicators:** Real-time updates are marked by a 6px pulsing dot next to "Live" data streams.
- **Buttons:** 
  - *Primary:* Solid #0066FF, white text.
  - *Secondary:* Ghost style with 1px Deep Navy border.
  - *Actionable Items:* Small (32px height) for density.
- **Maker-Checker Cues:** Workflows require dual-state visual markers. Items "Pending Approval" use a dashed Amber border, while "Verified" items use a solid Green subtle left-border accent (4px).
- **Sidebar:** Deep Navy background (#0A192F). Active items feature a Vibrant Blue left-accent bar and a subtle translucent blue background tint.