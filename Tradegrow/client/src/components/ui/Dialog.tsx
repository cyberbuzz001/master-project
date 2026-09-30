import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from './Button';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /**
   * Set false while a consequential, already-in-flight action (e.g. an order
   * submission that's already been sent to the server) is pending, so Escape
   * and backdrop-click can't make the user think they cancelled something
   * that's actually still happening. Defaults to true. When false, the only
   * way to close is calling onClose from your own footer/content.
   */
  dismissible?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-3xl',
  full: 'sm:max-w-6xl w-full sm:w-[95vw]',
};

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * One dialog primitive for the whole app: centered modal at sm: (640px) and
 * above, bottom sheet below it — same component, no viewport-detection prop
 * needed, it decides via CSS. Supersedes the app's ~11 ad hoc modal
 * implementations and the disagreeing backdrop values noted in
 * .design/client-panel-redesign/DESIGN_TOKENS.md.
 */
export function Dialog({ isOpen, onClose, title, children, footer, size = 'md', dismissible = true }: DialogProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const closeTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement;
      setShouldRender(true);
      // Let the initial (hidden) frame paint before transitioning in, or the
      // enter transition never triggers (element would already be "visible"
      // on its very first render).
      requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)));
    } else {
      setIsVisible(false);
      closeTimeout.current = window.setTimeout(() => {
        setShouldRender(false);
        previouslyFocused.current?.focus?.();
      }, 250); // matches --duration-normal
    }
    return () => {
      if (closeTimeout.current) window.clearTimeout(closeTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Body scroll lock while mounted
  useEffect(() => {
    if (!shouldRender) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [shouldRender]);

  // Move focus into the dialog once it's visible
  useEffect(() => {
    if (!isVisible) return;
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable || dialogRef.current)?.focus();
  }, [isVisible]);

  // Escape to close, Tab/Shift+Tab trapped inside
  useEffect(() => {
    if (!shouldRender) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dismissible) onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shouldRender, onClose, dismissible]);

  if (!shouldRender) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
      <div
        className={clsx(
          'absolute inset-0 bg-[var(--overlay-backdrop)]',
          'transition-opacity duration-[var(--duration-normal)] ease-[var(--easing-default)]',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        tabIndex={-1}
        className={clsx(
          'relative bg-[var(--bg-surface)] w-full sm:w-auto sm:min-w-[380px]',
          SIZE_CLASSES[size],
          'max-h-[88vh] sm:max-h-[85vh] overflow-y-auto',
          'rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]',
          'border border-[var(--border-color)] shadow-[var(--shadow-xl)]',
          'transition-all duration-[var(--duration-normal)] ease-[var(--easing-out)] motion-reduce:transition-none',
          isVisible
            ? 'translate-y-0 sm:scale-100 sm:opacity-100'
            : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {title && (
          <div className="flex items-center justify-between px-[var(--space-xl)] py-[var(--space-lg)] border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-surface)]">
            <h2 id="dialog-title" className="font-headline font-bold text-[var(--font-size-md)] text-[var(--text-main)]">
              {title}
            </h2>
            {dismissible && (
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
        <div className="p-[var(--space-xl)]">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-[var(--space-xl)] py-[var(--space-lg)] border-t border-[var(--border-color)] sticky bottom-0 bg-[var(--bg-surface)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
