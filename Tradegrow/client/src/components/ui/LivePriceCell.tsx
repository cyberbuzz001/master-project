import React from 'react';
import { useLiveTickFlash } from '../../hooks/useLiveTickFlash';

export interface LivePriceCellProps {
  value: number | string | undefined | null;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  showSign?: boolean;
  colorBySign?: boolean;
  highlightTicks?: boolean;
  className?: string;
  fallback?: string;
}

export const LivePriceCell: React.FC<LivePriceCellProps> = ({
  value,
  prefix = '₹',
  suffix = '',
  decimals = 2,
  showSign = false,
  colorBySign = false,
  highlightTicks = true,
  className = '',
  fallback = '—',
}) => {
  const numericVal =
    value !== undefined && value !== null && value !== ''
      ? typeof value === 'number'
        ? value
        : parseFloat(value)
      : null;

  const { flashClass } = useLiveTickFlash(highlightTicks ? numericVal : null);

  if (numericVal === null || isNaN(numericVal)) {
    return <span className={`font-mono tabular-nums text-[var(--text-muted)] ${className}`}>{fallback}</span>;
  }

  const sign = showSign && numericVal > 0 ? '+' : '';
  const formattedNumber = numericVal.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const colorClass = colorBySign
    ? numericVal > 0
      ? 'text-[var(--gain)]'
      : numericVal < 0
      ? 'text-[var(--loss)]'
      : 'text-[var(--text-main)]'
    : '';

  return (
    <span
      className={`inline-block font-mono tabular-nums px-1 py-0.5 rounded transition-colors duration-200 ${colorClass} ${flashClass} ${className}`}
      data-tabular-nums="true"
    >
      {sign}
      {prefix}
      {formattedNumber}
      {suffix}
    </span>
  );
};
