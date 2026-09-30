/**
 * P&L presentation helpers.
 *
 * The app-wide pattern used to be `pnl >= 0 ? gain : loss`, which paints an
 * exactly-zero P&L green and prefixes it with "+". On an account that hasn't
 * traded yet that reads as a claimed gain where none exists — flagged as a
 * tone bug in DESIGN_REVIEW.md ("Could Improve" #1). Zero is genuinely a third
 * state and gets neutral treatment here.
 */

/** Colour token for a P&L figure: gain / loss / neutral at exactly zero. */
export function pnlColorClass(value: number): string {
  if (value > 0) return 'text-[var(--gain)]';
  if (value < 0) return 'text-[var(--loss)]';
  return 'text-[var(--text-muted)]';
}

/** "+" only for genuine gains — never on zero, and never on negatives (the minus sign is already there). */
export function pnlSign(value: number): string {
  return value > 0 ? '+' : '';
}

/** Formats a signed rupee P&L, e.g. "+₹1,234.00" / "-₹560.00" / "₹0.00". */
export function formatPnl(value: number, fractionDigits = 2): string {
  return `${pnlSign(value)}₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** Formats a signed percentage, e.g. "+1.24%" / "-0.30%" / "0.00%". */
export function formatPnlPct(value: number, fractionDigits = 2): string {
  return `${pnlSign(value)}${value.toFixed(fractionDigits)}%`;
}
