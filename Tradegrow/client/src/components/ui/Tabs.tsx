import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** aria-label for the tablist — required, since tabs are meaningless to screen readers without context. */
  ariaLabel: string;
}

/**
 * Horizontally-scrollable pill row, one implementation used everywhere a
 * page needs tabs (Portfolio's 5, Profile's 8) — reuses the pattern already
 * proven in AdminPanel's mobile nav rather than inventing a new one, per
 * .design/client-panel-redesign/INFORMATION_ARCHITECTURE.md's Component
 * Reuse Map. Same visual treatment at every breakpoint; it already degrades
 * safely to horizontal scroll on narrow screens.
 */
export function Tabs({ items, value, onChange, className, ariaLabel }: TabsProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Scroll the active tab into view on every change (including the initial
  // route-driven mount, e.g. landing directly on a tab N clicks deep in the
  // row) — without this, a row with enough items to overflow (5+ at mobile
  // widths, first hit when Portfolio grew from 3 tabs to 5) can leave the
  // selected tab scrolled off-screen with no visual indicator which one is
  // active, on an otherwise-silent horizontal-scroll row.
  useEffect(() => {
    tabRefs.current.get(value)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  const focusTab = (index: number) => {
    const item = items[(index + items.length) % items.length];
    tabRefs.current.get(item.value)?.focus();
    onChange(item.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusTab(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusTab(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusTab(items.length - 1);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx('flex items-center gap-1.5 overflow-x-auto scrollbar-none', className)}
    >
      {items.map((item, index) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              if (el) tabRefs.current.set(item.value, el);
              else tabRefs.current.delete(item.value);
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={clsx(
              // min-h-[44px] only below md — same scoped touch-target rule
              // Button uses, so the pill row stays compact on desktop.
              'flex items-center gap-2 px-3.5 py-1.5 min-h-[44px] md:min-h-0 rounded-[var(--radius-full)] flex-shrink-0',
              'text-xs font-bold whitespace-nowrap cursor-pointer',
              'transition-all duration-[var(--duration-fast)] ease-[var(--easing-default)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
              isActive
                ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/40'
                : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
