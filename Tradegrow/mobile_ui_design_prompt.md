# TradeGrow Simplified Mobile UI Design Prompt

Redesign the TradeGrow mobile trading experience as a calm, fast, thumb-friendly financial workflow for retail investors who need to check markets, review a watchlist, place simulated trades, and monitor positions without visual overload.

## Product direction

- Tone: trustworthy, focused, calm, precise, and slightly premium.
- Prioritize scan speed over decoration.
- Keep the current TradeGrow identity, live market data behavior, dark/light themes, and financial number formatting.
- Use the existing React, Tailwind, Lucide icon, and CSS-variable conventions. Do not add a new UI library unless necessary.
- Do not use gradients, oversized hero sections, decorative blobs, or marketing-style cards inside the trading workflow.

## Mobile information architecture

Use a fixed bottom navigation with exactly five primary destinations:

1. Home — market overview, indices, quick actions, and account snapshot.
2. Watchlist — saved symbols, live prices, search, and quick chart/order actions.
3. Trade — the terminal workspace with chart, instrument selector, order ticket, and market depth.
4. Positions — open positions first, then orders, history, holdings, analytics, and journal.
5. More — Option Chain, Profile, Add Funds, Notifications, Support, and Admin when authorized.

The active destination must be obvious through icon, label, color, and a subtle background treatment. Keep labels readable at 11–12px minimum. Every primary navigation target must be at least 44x44 CSS pixels, preferably 48px high.

## Screen rules

- Design for 320px minimum width and responsive reflow through 768px.
- Respect `safe-area-inset-bottom` and `safe-area-inset-top`.
- Never hide content behind fixed navigation or fixed P&L summaries.
- Use one clear page title, one primary action, and one secondary action per screen.
- Keep live price, change, and P&L values tabular and stable so numbers do not cause layout shift.
- Use compact cards only when they improve scanning; avoid nested cards.
- Use bottom sheets for quick actions and confirmation flows, with focus management and an explicit close button.
- Use green/red with text and icons, never color alone, to communicate gains, losses, or order state.
- Make loading, stale-data, reconnecting, empty, and error states explicit.

## Trading safety

- Clearly label simulation/paper-trading mode wherever relevant.
- Show instrument, side, quantity, price, estimated margin, and risk warning before confirmation.
- Keep Buy and Sell actions visually distinct but equally accessible.
- Require a confirmation step for destructive or irreversible actions.
- Never imply that a quote, order, or regulatory status is verified unless the underlying data is verified.

## Accessibility and quality

- Use semantic buttons and links, not clickable generic containers.
- Add accessible names to icon-only controls.
- Provide visible focus states, Escape-to-close behavior, focus restoration, and screen-reader announcements for dynamic status.
- Support reduced motion and text scaling.
- Verify contrast in light and dark themes.
- Test 320px, 360px, 390px, 412px, and 768px widths on iOS Safari and Android Chrome.

## Deliverable

Produce a polished, production-ready mobile UI that feels simpler after one glance: Home and Watchlist for discovery, Trade for action, Positions for control, and More for everything secondary. Preserve existing routes and data behavior, document any route or interaction changes, and verify the result with TypeScript compilation plus mobile browser smoke tests.
