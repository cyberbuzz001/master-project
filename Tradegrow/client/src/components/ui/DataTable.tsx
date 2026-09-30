import React from 'react';
import clsx from 'clsx';
import { Card } from './Card';

export interface DataTableColumn<T> {
  key: string;
  header: string | React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** This column's rendered content becomes the mobile card's title. Exactly one column should set this. */
  mobilePrimary?: boolean;
  /** Dropped entirely from the mobile card (e.g. an ID column, or one already implied by context). Desktop still shows it. */
  mobileHidden?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  /** Short headline above `emptyMessage`. Without it the empty state stays the plain single-line form. */
  emptyTitle?: string;
  /** Decorative glyph for the empty state — hidden from assistive tech, since `emptyTitle`/`emptyMessage` already carry the meaning. */
  emptyIcon?: React.ReactNode;
  /** A way *out* of the empty state (e.g. "Browse stocks"). Empty states should offer an action, not just explain the absence. */
  emptyAction?: React.ReactNode;
  isLoading?: boolean;
  loadingRowCount?: number;
  /** Rendered in the mobile card's footer (e.g. action buttons) — on desktop, put actions in their own column instead. */
  renderMobileActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  renderExpandedRow?: (row: T) => React.ReactNode;
  isRowExpanded?: (row: T) => boolean;
}

const ALIGN_CLASSES: Record<NonNullable<DataTableColumn<any>['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * One table implementation for the whole app: a real <table> at md (768px)
 * and above, a stacked-card list below it — same data, same columns prop,
 * one breakpoint rule. Directly replaces the overflow-x-auto-only /
 * overflow-hidden-clipped patterns found in OrdersPositionsView.tsx and (in
 * the admin phase) CustomerList.tsx.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No records found.',
  emptyTitle,
  emptyIcon,
  emptyAction,
  isLoading = false,
  loadingRowCount = 4,
  renderMobileActions,
  onRowClick,
  renderExpandedRow,
  isRowExpanded,
}: DataTableProps<T>) {
  const primaryColumn = columns.find((c) => c.mobilePrimary) ?? columns[0];
  const mobileColumns = columns.filter((c) => c !== primaryColumn && !c.mobileHidden);

  if (isLoading) {
    return (
      <>
        <div className="hidden md:block space-y-2">
          {Array.from({ length: loadingRowCount }).map((_, i) => (
            <div key={i} className="h-11 rounded-[var(--radius-md)] skeleton-shimmer" />
          ))}
        </div>
        <div className="md:hidden space-y-2">
          {Array.from({ length: loadingRowCount }).map((_, i) => (
            <div key={i} className="h-24 rounded-[var(--radius-md)] skeleton-shimmer" />
          ))}
        </div>
      </>
    );
  }

  if (rows.length === 0) {
    // Richer form only when the caller supplies a title/icon/action — callers
    // that pass just `emptyMessage` keep the original single-line rendering,
    // so this stays backward compatible for every existing usage.
    const isRich = Boolean(emptyTitle || emptyIcon || emptyAction);
    if (!isRich) {
      return <div className="py-12 text-center text-sm text-[var(--text-muted)]">{emptyMessage}</div>;
    }
    return (
      <div className="py-12 px-6 flex flex-col items-center text-center card-enter">
        {emptyIcon && (
          <div
            className="w-12 h-12 rounded-full bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] flex items-center justify-center mb-3.5"
            aria-hidden="true"
          >
            {emptyIcon}
          </div>
        )}
        {emptyTitle && <h4 className="text-sm font-bold text-[var(--text-main)]">{emptyTitle}</h4>}
        {emptyMessage && (
          <p className="mt-1.5 text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">{emptyMessage}</p>
        )}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet-landscape: real table, horizontal scroll as a fallback for narrow windows, not the primary responsive strategy.
          tabIndex + role/aria-label make the scrollable region itself keyboard-reachable (arrow
          keys scroll it once focused) — axe's scrollable-region-focusable rule, and a real gap
          for a keyboard-only user on any table wide enough to need this fallback. */}
      <div className="hidden md:block overflow-x-auto" tabIndex={0} role="region" aria-label="Table data, scroll horizontally for more columns">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-3 py-2.5 text-[11px] font-bold uppercase tracking-[var(--letter-spacing-wide)] text-[var(--text-tertiary)] whitespace-nowrap',
                    ALIGN_CLASSES[col.align ?? 'left'],
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isExpanded = isRowExpanded ? isRowExpanded(row) : false;
              return (
                <React.Fragment key={rowKey(row)}>
                  <tr
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={clsx(
                      'border-b border-[var(--border-light)] transition-colors duration-[var(--duration-fast)]',
                      onRowClick && 'cursor-pointer hover:bg-[var(--bg-surface-elevated)]',
                      isExpanded && 'bg-[var(--bg-surface-elevated)]/60'
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={clsx('px-3 py-3 text-sm text-[var(--text-main)]', ALIGN_CLASSES[col.align ?? 'left'], col.className)}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpandedRow && (
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-body)]/60">
                      <td colSpan={columns.length} className="p-4">
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet-portrait: stacked cards, same data */}
      <div className="md:hidden space-y-2.5">
        {rows.map((row) => {
          const isExpanded = isRowExpanded ? isRowExpanded(row) : false;
          return (
            <Card
              key={rowKey(row)}
              padding="sm"
              interactive={Boolean(onRowClick)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <div className="font-headline font-bold text-[var(--text-main)] mb-2">
                {primaryColumn.render(row)}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {mobileColumns.map((col) => (
                  <div key={col.key} className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-[var(--letter-spacing-wide)] text-[var(--text-tertiary)]">
                      {col.header}
                    </span>
                    <span className="text-sm text-[var(--text-main)]">{col.render(row)}</span>
                  </div>
                ))}
              </div>
              {renderMobileActions && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-light)]">
                  {renderMobileActions(row)}
                </div>
              )}
              {isExpanded && renderExpandedRow && (
                <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
                  {renderExpandedRow(row)}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
