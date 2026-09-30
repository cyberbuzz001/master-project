import React from 'react';
import clsx from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds the hover-lift treatment from the existing .tg-stat-card pattern — use for clickable/summary cards, not static content containers. */
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-[var(--space-lg)]',
  md: 'p-[var(--space-xl)]',
  lg: 'p-[var(--space-2xl)]',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, padding = 'md', className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(
        'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[var(--radius-md)] shadow-[var(--shadow-sm)]',
        'transition-all duration-[var(--duration-normal)] ease-[var(--easing-default)]',
        interactive && 'hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 hover:border-[var(--primary)]/30 cursor-pointer',
        PADDING_CLASSES[padding],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export function CardHeader({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('flex items-center justify-between gap-3 mb-[var(--space-lg)]', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx(
        'font-headline font-bold text-[var(--font-size-md)] text-[var(--text-main)] leading-[var(--line-height-tight)]',
        className
      )}
      {...rest}
    >
      {children}
    </h3>
  );
}
