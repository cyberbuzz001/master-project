import React, { useState, useEffect } from 'react';
import {
  LifeBuoy, MessageSquareText, X, CheckCircle2, AlertTriangle,
  RefreshCw, Inbox, Clock, Zap, User, Send
} from 'lucide-react';
import { DataTable, DataTableColumn } from '../ui/DataTable';
import { Badge } from '../ui/Badge';
import { CustomerHoverCard } from './CustomerHoverCard';

interface SupportTicketsProps {
  token: string;
  onOpenCustomer360?: (userId: string) => void;
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]/30',
  IN_PROGRESS: 'bg-[var(--info-light)] text-[var(--info)] border border-[var(--info)]/30',
  RESOLVED: 'bg-[var(--gain-light)] text-[var(--gain)] border border-[var(--gain)]/30',
  CLOSED: 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-color)]',
};

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: 'text-[var(--loss)]',
  HIGH: 'text-[var(--warning)]',
  MEDIUM: 'text-[var(--info)]',
  LOW: 'text-[var(--text-muted)]',
};

const CANNED_RESPONSES = [
  'Deposit confirmed and successfully credited to your trading ledger.',
  'Your KYC documents have been reviewed and approved.',
  'KYC action required: Please re-upload clear front & back photos of your PAN card.',
  'Order execution investigated: Market volatility spike caused slippage at exchange level.',
  'Issue resolved. Please restart the trading client if the issue persists.',
];

export const SupportTickets: React.FC<SupportTicketsProps> = ({ token, onOpenCustomer360 }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [respondTarget, setRespondTarget] = useState<any | null>(null);
  const [respondStatus, setRespondStatus] = useState('');
  const [respondNotes, setRespondNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [respondMsg, setRespondMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTickets = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/v1/admin/support/tickets?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setTickets(d.tickets);
          setTotal(d.total);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTickets();
  }, [token, statusFilter]);

  const openRespondModal = (t: any) => {
    setRespondTarget(t);
    setRespondStatus(t.status);
    setRespondNotes(t.admin_notes || '');
    setRespondMsg(null);
  };

  const handleRespondSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondTarget) return;
    setSubmitting(true);
    setRespondMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/support/tickets/${respondTarget.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: respondStatus, adminNotes: respondNotes }),
      });
      const data = await res.json();
      if (data.success) {
        setRespondMsg({ type: 'success', text: data.message || 'Ticket updated.' });
        fetchTickets();
        setTimeout(() => setRespondTarget(null), 1200);
      } else {
        setRespondMsg({ type: 'error', text: data.error?.message || 'Failed to update ticket' });
      }
    } catch (err: any) {
      setRespondMsg({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  const getOpenHours = (createdAt?: string): number => {
    if (!createdAt) return 0;
    const diffMs = Date.now() - new Date(createdAt).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  };

  const columns: DataTableColumn<any>[] = [
    {
      key: 'subject', header: 'Subject & Client', mobilePrimary: true,
      render: (t: any) => (
        <div>
          <div className="font-bold text-xs text-[var(--text-main)]">{t.subject}</div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1.5 mt-0.5">
            <CustomerHoverCard userId={t.user_id || t.id} token={token} onOpenCustomer360={onOpenCustomer360}>
              <span className="font-bold text-[var(--primary)]">{t.username}</span>
            </CustomerHoverCard>
            <span>·</span>
            <span>{t.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category', header: 'Category',
      render: (t: any) => <Badge variant="neutral">{t.category}</Badge>
    },
    {
      key: 'priority', header: 'Priority',
      render: (t: any) => <span className={`text-[10px] font-black uppercase ${PRIORITY_STYLE[t.priority] || 'text-[var(--text-muted)]'}`}>{t.priority}</span>
    },
    {
      key: 'status', header: 'Status',
      render: (t: any) => {
        const openHours = getOpenHours(t.created_at);
        const isSlaBreached = openHours > 12 && t.status !== 'RESOLVED' && t.status !== 'CLOSED';

        return (
          <div className="flex flex-col items-start gap-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_STYLE[t.status] || STATUS_STYLE.CLOSED}`}>
              {t.status}
            </span>
            {isSlaBreached && (
              <span className="text-[9px] font-black text-[var(--loss)] flex items-center gap-1 font-mono">
                <Clock className="w-2.5 h-2.5" /> {openHours}h SLA Breach
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'opened', header: 'Created', mobileHidden: true,
      render: (t: any) => <span className="text-[10px] text-[var(--text-muted)] font-mono">{new Date(t.created_at).toLocaleString()}</span>
    },
    {
      key: 'actions', header: 'Action', align: 'center', mobileHidden: true,
      render: (t: any) => (
        <button
          onClick={() => openRespondModal(t)}
          className="px-2.5 py-1 rounded-lg bg-[var(--info)]/15 text-[var(--info)] border border-[var(--info)]/30 hover:bg-[var(--info)] hover:text-white text-[10px] font-black flex items-center gap-1 transition-colors mx-auto cursor-pointer"
        >
          <MessageSquareText className="w-3.5 h-3.5" />
          <span>Respond</span>
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 h-full text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)] p-3 border border-[var(--border-color)] rounded-xl">
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter by ticket status"
            className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-bold outline-none focus:border-[var(--primary)]"
          >
            <option value="">All Statuses ({total})</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTickets}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden flex-1 overflow-y-auto p-3 shadow-xs">
        <DataTable
          columns={columns}
          rows={tickets}
          rowKey={(t: any) => t.id}
          isLoading={loading}
          emptyIcon={<Inbox className="w-6 h-6" />}
          emptyTitle="No support tickets"
          emptyMessage="No customer support tickets match the current filter."
        />
      </div>

      {respondTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--info)]/10 text-[var(--info)] border border-[var(--info)]/20">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Respond to Support Ticket</h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">{respondTarget.username} — {respondTarget.subject}</p>
                </div>
              </div>
              <button onClick={() => setRespondTarget(null)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg bg-[var(--bg-surface-inset)] transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[var(--bg-body)] p-3.5 rounded-xl border border-[var(--border-color)] text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Category</span><span className="text-[var(--text-main)] font-bold">{respondTarget.category}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Priority</span><span className={`font-bold ${PRIORITY_STYLE[respondTarget.priority] || 'text-[var(--text-main)]'}`}>{respondTarget.priority}</span></div>
              <div className="pt-1.5 border-t border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] block mb-1">Customer Description:</span>
                <p className="text-[var(--text-main)] leading-relaxed">{respondTarget.description}</p>
              </div>
            </div>

            <form onSubmit={handleRespondSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Status</label>
                <select
                  value={respondStatus}
                  onChange={e => setRespondStatus(e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs font-semibold focus:outline-none focus:border-[var(--info)]"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              {/* Canned Responses Helper */}
              <div>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                  ⚡ Quick Insert Canned Template:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {CANNED_RESPONSES.map((res, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRespondNotes(res)}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface-inset)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] truncate max-w-xs transition cursor-pointer"
                      title={res}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Official Response</label>
                <textarea
                  value={respondNotes}
                  onChange={e => setRespondNotes(e.target.value)}
                  rows={4}
                  placeholder="Write a response the customer will see in their Support Tickets..."
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs resize-none focus:outline-none focus:border-[var(--info)]"
                />
              </div>

              {respondMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${respondMsg.type === 'success' ? 'bg-[var(--gain-light)] text-[var(--gain)] border border-[var(--gain)]/30' : 'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]/30'}`}>
                  {respondMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{respondMsg.text}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setRespondTarget(null)} className="px-4 py-2 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)]/80 text-[var(--text-muted)] font-bold text-xs cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-[var(--info)] hover:bg-[var(--info)]/90 disabled:opacity-40 text-white font-black text-xs transition cursor-pointer flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Saving...' : 'Save & Dispatch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
