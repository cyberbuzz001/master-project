import React from 'react';
import clsx from 'clsx';

export type BadgeVariant = 'gain' | 'loss' | 'warning' | 'info' | 'neutral' | 'primary';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  gain: 'bg-[var(--gain-light)] text-[var(--gain)]',
  loss: 'bg-[var(--loss-light)] text-[var(--loss)]',
  warning: 'bg-[var(--warning-light)] text-[var(--warning)]',
  info: 'bg-[var(--info-light)] text-[var(--info)]',
  neutral: 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]',
  primary: 'bg-[var(--primary-light)] text-[var(--primary)]',
};

/**
 * Status pill. Never rely on color alone to convey meaning (per the brief's
 * accessibility requirement) — pair with the `dot` indicator or descriptive
 * text (e.g. "Pending", "Rejected"), not just a colored chip on its own.
 */
export function Badge({ variant = 'neutral', dot = false, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-full)]',
        'text-[var(--font-size-xs)] font-bold leading-none whitespace-nowrap',
        VARIANT_CLASSES[variant],
        className
      )}
      {...rest}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
