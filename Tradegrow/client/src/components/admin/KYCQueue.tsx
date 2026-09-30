import React, { useState, useEffect } from 'react';
import {
  FileText, CheckCircle2, XCircle, Download, AlertTriangle, Search,
  FileCheck, ExternalLink, Columns, Table as TableIcon, Clock, CheckSquare,
  Square, ShieldCheck, RefreshCw, User
} from 'lucide-react';
import { DataTable, DataTableColumn } from '../ui/DataTable';
import { Badge } from '../ui/Badge';
import { CustomerHoverCard } from './CustomerHoverCard';

interface KYCQueueProps {
  token: string;
  onOpenCustomer360?: (userId: string) => void;
}

export const KYCQueue: React.FC<KYCQueueProps> = ({ token, onOpenCustomer360 }) => {
  const [applications, setApplications] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'TABLE' | 'KANBAN'>('TABLE');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [rejectionCategory, setRejectionCategory] = useState<string>('DOCUMENT_INVALID');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [bulkSubmitting, setBulkSubmitting] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchApplications = () => {
    setLoading(true);
    fetch('/api/v1/admin/kyc/applications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.applications)) {
          setApplications(d.applications);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchApplications(); }, [token]);

  const handleReview = async (appId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_RESUBMISSION') => {
    setActionMessage(null);
    try {
      const res = await fetch('/api/v1/admin/kyc/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          applicationId: appId,
          action,
          rejectionReason: actionNotes || (action === 'APPROVE' ? 'Approved by Admin' : 'Documents rejected by Admin'),
          rejectionCategory
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: data.message });
        setActionNotes('');
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(appId);
          return next;
        });
        fetchApplications();
      } else {
        setActionMessage({ type: 'error', text: data.error?.message || 'Review failed' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleBulkReview = async (action: 'APPROVE' | 'REJECT') => {
    if (selectedIds.size === 0) return;
    setBulkSubmitting(true);
    setActionMessage(null);

    try {
      const ids = Array.from(selectedIds);
      let successCount = 0;
      for (const id of ids) {
        const res = await fetch('/api/v1/admin/kyc/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            applicationId: id,
            action,
            rejectionReason: actionNotes || (action === 'APPROVE' ? 'Bulk Approved by Admin' : 'Bulk Rejected by Admin'),
            rejectionCategory
          })
        });
        if (res.ok) successCount++;
      }

      setActionMessage({ type: 'success', text: `Bulk ${action.toLowerCase()} processed ${successCount} of ${ids.length} applications.` });
      setSelectedIds(new Set());
      setActionNotes('');
      fetchApplications();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setBulkSubmitting(false);
    }
  };

  const getPendingHours = (submittedAt?: string): number => {
    if (!submittedAt) return 0;
    const diffMs = Date.now() - new Date(submittedAt).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  };

  const filteredApps = applications.filter(a => {
    const matchesStatus = filterStatus ? a.status === filterStatus : true;
    const matchesSearch = searchQuery
      ? (a.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         a.pan_number?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesStatus && matchesSearch;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredApps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApps.map(a => a.id)));
    }
  };

  const statusColors: Record<string, string> = {
    SUBMITTED: 'bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning)]/30',
    UNDER_REVIEW: 'bg-[var(--info-light)] text-[var(--info)] border-[var(--info)]/30',
    APPROVED: 'bg-[var(--gain-light)] text-[var(--gain)] border-[var(--gain)]/30',
    REJECTED: 'bg-[var(--loss-light)] text-[var(--loss)] border-[var(--loss)]/30',
    RESUBMISSION_REQUIRED: 'bg-purple-950/40 text-purple-400 border-purple-800/40',
    NOT_STARTED: 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)]',
  };

  const kanbanColumns = [
    { key: 'SUBMITTED', title: 'Submitted (Action Required)', items: filteredApps.filter(a => a.status === 'SUBMITTED' || a.status === 'NOT_STARTED') },
    { key: 'UNDER_REVIEW', title: 'Under Review', items: filteredApps.filter(a => a.status === 'UNDER_REVIEW' || a.status === 'RESUBMISSION_REQUIRED') },
    { key: 'APPROVED', title: 'Approved', items: filteredApps.filter(a => a.status === 'APPROVED') },
    { key: 'REJECTED', title: 'Rejected', items: filteredApps.filter(a => a.status === 'REJECTED') },
  ];

  return (
    <div className="flex flex-col gap-4 h-full text-xs">
      
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)] p-3 border border-[var(--border-color)] rounded-xl">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'TABLE' ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('KANBAN')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'KANBAN' ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            aria-label="Filter by application status"
            className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--primary)] font-bold"
          >
            <option value="">All Applications ({applications.length})</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search user, email, PAN..."
              className="pl-8 pr-3 py-1.5 bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary)] w-48"
            />
          </div>

          <input
            type="text"
            value={actionNotes}
            onChange={e => setActionNotes(e.target.value)}
            placeholder="Review / Rejection notes..."
            className="w-56 bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 bg-[var(--primary)]/10 border border-[var(--primary)]/30 px-2.5 py-1 rounded-lg">
              <span className="font-bold text-[var(--primary)] text-[11px]">{selectedIds.size} Selected</span>
              <button
                type="button"
                disabled={bulkSubmitting}
                onClick={() => handleBulkReview('APPROVE')}
                className="px-2 py-0.5 rounded bg-[var(--gain)] text-white text-[10px] font-bold hover:bg-[var(--gain)]/90 transition cursor-pointer"
              >
                Bulk Approve
              </button>
              <button
                type="button"
                disabled={bulkSubmitting}
                onClick={() => handleBulkReview('REJECT')}
                className="px-2 py-0.5 rounded bg-[var(--loss)] text-white text-[10px] font-bold hover:bg-[var(--loss)]/90 transition cursor-pointer"
              >
                Bulk Reject
              </button>
            </div>
          )}

          <button
            onClick={fetchApplications}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] font-bold hover:bg-[var(--bg-surface-elevated)] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-3 rounded-xl font-bold flex items-center gap-2 ${
          actionMessage.type === 'success' ? 'bg-[var(--gain-light)] border border-[var(--gain)]/30 text-[var(--gain)]' : 'bg-[var(--loss-light)] border border-[var(--loss)]/30 text-[var(--loss)]'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* ── KANBAN PIPELINE VIEW ────────────────────────────────────────── */}
      {viewMode === 'KANBAN' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {kanbanColumns.map(col => (
            <div key={col.key} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
                <span className="font-bold text-xs text-[var(--text-main)]">{col.title}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--bg-surface-inset)] text-[var(--text-muted)] border border-[var(--border-color)]">
                  {col.items.length}
                </span>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto max-h-[68vh] pr-1">
                {col.items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)] italic">No items</div>
                ) : (
                  col.items.map(app => {
                    const pendingHours = getPendingHours(app.submitted_at);
                    const isSlaBreached = pendingHours > 24 && app.status !== 'APPROVED' && app.status !== 'REJECTED';

                    return (
                      <div key={app.id} className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-2.5 shadow-2xs hover:border-[var(--primary)]/40 transition-all">
                        <div className="flex items-start justify-between gap-1.5">
                          <CustomerHoverCard userId={app.user_id || app.id} token={token} onOpenCustomer360={onOpenCustomer360}>
                            <span className="font-bold text-xs text-[var(--text-main)] block">{app.username}</span>
                          </CustomerHoverCard>
                          {isSlaBreached && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[var(--loss)]/20 text-[var(--loss)] border border-[var(--loss)]/40 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {pendingHours}h SLA
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-[11px] font-mono text-[var(--text-muted)]">
                          <p>PAN: <span className="text-[var(--info)] font-bold">{app.pan_number || '—'}</span></p>
                          <p>Aadhaar: <span className="text-[var(--text-main)]">{app.aadhaar_number ? `•••• ${app.aadhaar_number.slice(-4)}` : '—'}</span></p>
                          <p className="text-[10px]">Submitted: {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}</p>
                        </div>

                        {app.documents && app.documents.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {app.documents.map((doc: any) => (
                              <a
                                key={doc.id}
                                href={`/api/v1/admin/kyc/documents/${doc.id}/download?token=${encodeURIComponent(token)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--info)] text-[9px] font-bold inline-flex items-center gap-1 hover:border-[var(--info)]"
                              >
                                <Download className="w-2.5 h-2.5" />
                                <span>{doc.document_type}</span>
                              </a>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-[var(--border-color)]">
                          {app.status !== 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => handleReview(app.id, 'APPROVE')}
                              className="flex-1 py-1 rounded-lg bg-[var(--gain-light)] text-[var(--gain)] border border-[var(--gain)]/30 hover:bg-[var(--gain)]/20 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                          )}
                          {app.status !== 'REJECTED' && (
                            <button
                              type="button"
                              onClick={() => handleReview(app.id, 'REJECT')}
                              className="flex-1 py-1 rounded-lg bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]/30 hover:bg-[var(--loss)]/20 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── TABLE VIEW ─────────────────────────────────────────────────── */
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3 shadow-xs">
          <DataTable
            columns={[
              {
                key: 'select',
                header: (
                  <button type="button" onClick={toggleSelectAll} className="cursor-pointer text-[var(--text-muted)]">
                    {selectedIds.size > 0 && selectedIds.size === filteredApps.length ? (
                      <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                ),
                className: 'w-8',
                render: (app: any) => (
                  <button type="button" onClick={() => toggleSelect(app.id)} className="cursor-pointer text-[var(--text-muted)]">
                    {selectedIds.has(app.id) ? (
                      <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                ),
              },
              {
                key: 'client', header: 'Client / Email', mobilePrimary: true,
                className: 'min-w-[160px]',
                render: (app: any) => (
                  <div>
                    <CustomerHoverCard userId={app.user_id || app.id} token={token} onOpenCustomer360={onOpenCustomer360}>
                      <span className="font-extrabold text-[var(--text-main)]">{app.username}</span>
                    </CustomerHoverCard>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono">{app.email}</div>
                  </div>
                ),
              },
              {
                key: 'pan', header: 'PAN Card', mobileHidden: true,
                className: 'min-w-[105px]',
                render: (app: any) => <span className="font-mono font-bold text-[var(--info)]">{app.pan_number || '—'}</span>
              },
              {
                key: 'aadhaar', header: 'Aadhaar', mobileHidden: true,
                className: 'min-w-[115px]',
                render: (app: any) => <span className="font-mono text-[var(--text-muted)]">{app.aadhaar_number || '—'}</span>
              },
              {
                key: 'documents', header: 'Uploaded Documents',
                className: 'min-w-[150px]',
                render: (app: any) => (
                  <div className="flex flex-wrap gap-1.5">
                    {app.documents && app.documents.length > 0 ? (
                      app.documents.map((doc: any) => (
                        <a
                          key={doc.id}
                          href={`/api/v1/admin/kyc/documents/${doc.id}/download?token=${encodeURIComponent(token)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded bg-[var(--bg-body)] border border-[var(--border-color)] hover:border-[var(--info)] text-[var(--info)] text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>{doc.document_type}</span>
                        </a>
                      ))
                    ) : (
                      <span className="text-[var(--text-tertiary)] italic text-[10px]">No files attached</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'status', header: 'Status',
                className: 'min-w-[110px]',
                render: (app: any) => {
                  const pendingHours = getPendingHours(app.submitted_at);
                  const isSlaBreached = pendingHours > 24 && app.status !== 'APPROVED' && app.status !== 'REJECTED';

                  return (
                    <div className="flex flex-col items-start gap-1">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border ${statusColors[app.status] || 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'}`}>
                        {app.status}
                      </span>
                      {isSlaBreached && (
                        <span className="text-[9px] font-black text-[var(--loss)] flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" /> {pendingHours}h SLA Breach
                        </span>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'submitted', header: 'Submitted', mobileHidden: true,
                className: 'min-w-[135px]',
                render: (app: any) => <span className="text-[10px] text-[var(--text-muted)] font-mono">{app.submitted_at ? new Date(app.submitted_at).toLocaleString() : '—'}</span>
              },
              {
                key: 'actions', header: 'Review Actions', align: 'center', mobileHidden: true,
                className: 'min-w-[210px] whitespace-nowrap',
                render: (app: any) => (
                  <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                    {app.status === 'APPROVED' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[var(--gain)] bg-[var(--gain-light)] border border-[var(--gain)]/20">
                          ✓ Approved
                        </span>
                        <button
                          onClick={() => handleReview(app.id, 'REJECT')}
                          className="px-2 py-1 rounded-lg bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]/30 hover:bg-[var(--loss)]/25 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Revoke Approval / Reject"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    ) : app.status === 'REJECTED' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[var(--loss)] bg-[var(--loss-light)] border border-[var(--loss)]/20">
                          ✕ Rejected
                        </span>
                        <button
                          onClick={() => handleReview(app.id, 'APPROVE')}
                          className="px-2 py-1 rounded-lg bg-[var(--gain-light)] text-[var(--gain)] border border-[var(--gain)]/30 hover:bg-[var(--gain)]/25 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Approve KYC"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleReview(app.id, 'APPROVE')}
                          className="px-2.5 py-1 rounded-lg bg-[var(--gain-light)] text-[var(--gain)] border border-[var(--gain)]/40 hover:bg-[var(--gain)]/30 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleReview(app.id, 'REJECT')}
                          className="px-2.5 py-1 rounded-lg bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]/40 hover:bg-[var(--loss)]/30 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
            rows={filteredApps}
            rowKey={(app: any) => app.id}
            isLoading={loading}
            emptyIcon={<FileCheck className="w-6 h-6" />}
            emptyTitle="Queue is empty"
            emptyMessage="No KYC applications found in queue."
          />
        </div>
      )}
    </div>
  );
};
