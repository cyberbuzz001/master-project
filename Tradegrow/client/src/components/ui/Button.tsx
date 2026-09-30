import React from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--primary)] text-white border border-transparent hover:bg-[var(--primary-hover)] shadow-sm hover:shadow-md',
  secondary:
    'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border-color)] hover:border-[var(--primary)]/40 hover:bg-[var(--bg-surface)]',
  ghost:
    'bg-transparent text-[var(--text-muted)] border border-transparent hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]',
  destructive:
    'bg-[var(--loss)] text-white border border-transparent hover:brightness-95 shadow-sm hover:shadow-md',
};

// The brief's 44x44 touch-target minimum is explicitly scoped to "below md"
// (DESIGN_TOKENS.md) — `sm`/`md` keep their compact desktop heights (32/40px,
// both under 44) via the `md:h-*` override, but get a `min-h-[44px]` floor
// below that breakpoint so every Button stays tappable on phones/tablets
// without inflating desktop tables and toolbars that rely on the tighter size.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] md:h-8 px-3 text-xs gap-1.5 rounded-[var(--radius-md)]',
  md: 'min-h-[44px] md:h-10 px-4 text-sm gap-2 rounded-[var(--radius-md)]',
  lg: 'h-12 px-6 text-base gap-2 rounded-[var(--radius-lg)]',
  // 44x44 minimum touch target even at "icon" size, per the brief's a11y requirement.
  icon: 'h-11 w-11 min-h-[44px] min-w-[44px] p-0 rounded-[var(--radius-md)] justify-center',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', isLoading = false, leftIcon, rightIcon, disabled, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={clsx(
        'inline-flex items-center font-semibold whitespace-nowrap select-none',
        'transition-all duration-[var(--duration-fast)] ease-[var(--easing-default)]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
        'active:scale-[0.97]',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        leftIcon
      )}
      {!isLoading && children}
      {!isLoading && rightIcon}
    </button>
  );
});
