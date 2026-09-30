import React, { useState, useEffect } from 'react';
import { Search, Filter, BookOpen, Download, Calendar, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { DataTable, DataTableColumn } from '../ui/DataTable';
import { exportToCsv } from '../../utils/csvExport';
import { CustomerHoverCard } from './CustomerHoverCard';
import { Badge } from '../ui/Badge';

interface LedgerViewerProps {
  token: string;
  onOpenCustomer360?: (userId: string) => void;
}

export const LedgerViewer: React.FC<LedgerViewerProps> = ({ token, onOpenCustomer360 }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [customerId, setCustomerId] = useState('');
  const [txnType, setTxnType] = useState('');
  const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLedger = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100', offset: String(page * 100) });
    if (customerId) params.set('customerId', customerId);
    if (txnType) params.set('type', txnType);
    if (dateRange !== 'ALL') params.set('dateRange', dateRange);

    fetch(`/api/v1/admin/ledger?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEntries(d.entries);
          setTotal(d.total);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLedger();
  }, [token, customerId, txnType, dateRange, page]);

  return (
    <div className="flex flex-col gap-4 h-full text-xs">
      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)] p-3 border border-[var(--border-color)] rounded-xl">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px] flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              placeholder="Filter by Client ID or Username..."
              className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg pl-9 pr-4 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          <select
            value={txnType}
            onChange={e => setTxnType(e.target.value)}
            className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--primary)] font-bold"
          >
            <option value="">All Transaction Types</option>
            <option value="CREDIT">Credit</option>
            <option value="DEBIT">Debit</option>
            <option value="BROKERAGE">Brokerage</option>
            <option value="WITHDRAWAL">Withdrawal</option>
            <option value="MARGIN_BLOCK">Margin Block</option>
            <option value="MARGIN_RELEASE">Margin Release</option>
          </select>

          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value as any)}
            className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="WEEK">Last 7 Days</option>
            <option value="MONTH">This Month</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--text-muted)] font-mono font-bold">{total} entries recorded</span>
          <button
            onClick={() => exportToCsv('ledger', entries, [
              { header: 'Txn ID', value: (e: any) => e.transaction_id },
              { header: 'Client', value: (e: any) => e.username },
              { header: 'Type', value: (e: any) => e.transaction_type },
              { header: 'Amount', value: (e: any) => e.amount },
              { header: 'Balance Before', value: (e: any) => e.balance_before },
              { header: 'Balance After', value: (e: any) => e.balance_after },
              { header: 'Created By', value: (e: any) => e.created_by },
              { header: 'Time', value: (e: any) => new Date(e.created_at).toLocaleString() },
            ])}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-40 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden flex-1 overflow-y-auto p-3 shadow-xs">
        <DataTable
          columns={[
            {
              key: 'txnId', header: 'Txn ID', mobileHidden: true,
              render: (e: any) => <span className="font-mono text-[10px] text-[var(--text-muted)]">{e.transaction_id?.slice(0, 10)}</span>
            },
            {
              key: 'client', header: 'Client', mobilePrimary: true,
              render: (e: any) => (
                <CustomerHoverCard userId={e.user_id || e.customer_id || e.id} token={token} onOpenCustomer360={onOpenCustomer360}>
                  <span className="font-bold text-[var(--text-main)]">{e.username || e.user_id?.slice(0, 8)}</span>
                </CustomerHoverCard>
              )
            },
            {
              key: 'type', header: 'Type',
              render: (e: any) => {
                const isCredit = e.transaction_type === 'CREDIT' || e.transaction_type === 'MARGIN_RELEASE';
                return (
                  <Badge variant={isCredit ? 'gain' : 'loss'}>
                    {e.transaction_type}
                  </Badge>
                );
              },
            },
            {
              key: 'debit', header: 'Debit', align: 'right',
              render: (e: any) => (
                <span className="font-mono tabular-nums text-[var(--loss)] font-bold">
                  {e.transaction_type === 'DEBIT' || e.transaction_type === 'WITHDRAWAL' || e.transaction_type === 'BROKERAGE'
                    ? `-₹${parseFloat(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : '—'}
                </span>
              )
            },
            {
              key: 'credit', header: 'Credit', align: 'right',
              render: (e: any) => (
                <span className="font-mono tabular-nums text-[var(--gain)] font-bold">
                  {e.transaction_type === 'CREDIT' || e.transaction_type === 'MARGIN_RELEASE'
                    ? `+₹${parseFloat(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : '—'}
                </span>
              )
            },
            {
              key: 'before', header: 'Balance Before', align: 'right', mobileHidden: true,
              render: (e: any) => (
                <span className="font-mono tabular-nums text-[var(--text-muted)]">
                  ₹{parseFloat(e.balance_before || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              )
            },
            {
              key: 'after', header: 'Balance After', align: 'right',
              render: (e: any) => (
                <span className="font-mono tabular-nums text-[var(--text-main)] font-black">
                  ₹{parseFloat(e.balance_after || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              )
            },
            {
              key: 'createdBy', header: 'Initiated By', mobileHidden: true,
              render: (e: any) => <span className="text-[var(--text-muted)] text-[10px]">{e.created_by || 'SYSTEM'}</span>
            },
            {
              key: 'time', header: 'Timestamp', mobileHidden: true,
              render: (e: any) => <span className="text-[10px] text-[var(--text-muted)] font-mono">{new Date(e.created_at).toLocaleString()}</span>
            },
          ]}
          rows={entries}
          rowKey={(e: any) => e.id || e.transaction_id}
          isLoading={loading}
          emptyIcon={<BookOpen className="w-6 h-6" />}
          emptyTitle="No ledger entries"
          emptyMessage="No wallet ledger entries match the current filters."
        />
      </div>

      {total > 100 && (
        <div className="flex justify-between items-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] p-2 rounded-xl border border-[var(--border-color)]">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)]/80 disabled:opacity-30 rounded-lg font-bold cursor-pointer transition-colors"
          >
            ← Previous
          </button>
          <span className="font-mono">Page {page + 1} of {Math.ceil(total / 100)}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={(page + 1) * 100 >= total}
            className="px-3 py-1.5 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)]/80 disabled:opacity-30 rounded-lg font-bold cursor-pointer transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
