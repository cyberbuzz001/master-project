import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, UserMinus, Shield, Search, X, CheckCircle, XCircle } from 'lucide-react';
import { DataTable, DataTableColumn } from '../ui/DataTable';

interface ManagerManagementProps { token: string; }

export const ManagerManagement: React.FC<ManagerManagementProps> = ({ token }) => {
  const [managers, setManagers] = useState<any[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Assign panel
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [assignTargetUserId, setAssignTargetUserId] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  const fetchManagers = useCallback(() => {
    fetch('/api/v1/admin/managers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setManagers(d.managers); });
  }, [token]);

  useEffect(() => { fetchManagers(); }, [fetchManagers]);

  const fetchAssignments = useCallback((managerId: string) => {
    setLoadingAssignments(true);
    fetch(`/api/v1/admin/managers/${managerId}/assignments`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setAssignments(d.assignments); })
      .finally(() => setLoadingAssignments(false));
  }, [token]);

  useEffect(() => {
    if (selectedManagerId) fetchAssignments(selectedManagerId);
  }, [selectedManagerId, fetchAssignments]);

  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/v1/admin/customers?search=${encodeURIComponent(customerSearch)}&limit=10`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.success) setCustomerResults(d.customers || []); });
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch, token]);

  const handleAssign = async () => {
    if (!selectedManagerId || !assignTargetUserId) return;
    setSubmittingAssign(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/v1/admin/managers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ managerId: selectedManagerId, userId: assignTargetUserId }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        setCustomerSearch(''); setCustomerResults([]); setAssignTargetUserId('');
        fetchAssignments(selectedManagerId);
        fetchManagers();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to assign customer' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleUnassign = async (userId: string) => {
    if (!selectedManagerId) return;
    if (!window.confirm('Remove this customer from the manager\'s book?')) return;
    try {
      const res = await fetch('/api/v1/admin/managers/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ managerId: selectedManagerId, userId }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignments(prev => prev.filter(a => a.user_id !== userId));
        fetchManagers();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to unassign customer' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const selectedManager = managers.find(m => m.id === selectedManagerId);

  const managerColumns: DataTableColumn<any>[] = [
    {
      key: 'manager', header: 'Manager', mobilePrimary: true,
      render: (m: any) => (
        <button onClick={() => setSelectedManagerId(m.id)} className="text-left cursor-pointer">
          <div className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
            {m.username}
            {selectedManagerId === m.id && <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />}
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)]">{m.email}</div>
        </button>
      ),
    },
    { key: 'role', header: 'Role', render: (m: any) => <span className="bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded text-[10px] text-[var(--gogrow-blue)] font-bold">{m.role}</span> },
    { key: 'assigned', header: 'Assigned Customers', align: 'right', render: (m: any) => <span className="font-mono font-bold text-[var(--text-main)]">{m.assigned_users_count} <span className="text-[var(--text-tertiary)] font-normal">/ {m.max_users}</span></span> },
    { key: 'depositLimit', header: 'Deposit Approval Limit', align: 'right', mobileHidden: true, render: (m: any) => <span className="font-mono text-[var(--text-muted)]">₹{parseFloat(m.max_deposit_approval).toLocaleString('en-IN')}</span> },
    { key: 'withdrawLimit', header: 'Withdrawal Approval Limit', align: 'right', mobileHidden: true, render: (m: any) => <span className="font-mono text-[var(--text-muted)]">₹{parseFloat(m.max_withdrawal_approval).toLocaleString('en-IN')}</span> },
    {
      key: 'view', header: '', align: 'center',
      render: (m: any) => (
        <button
          onClick={() => setSelectedManagerId(m.id)}
          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${selectedManagerId === m.id ? 'bg-[var(--primary)] text-[var(--text-on-accent)]' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
        >
          {selectedManagerId === m.id ? 'Viewing' : 'View Book'}
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-[var(--gogrow-blue)]/10 text-[var(--gogrow-blue)] border border-[var(--gogrow-blue)]/20">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[var(--text-main)]">Manager Management</h2>
          <span className="text-[10px] text-[var(--text-muted)]">Assign customers to managers, review each manager's book, and their approval limits.</span>
        </div>
      </div>

      {actionMsg && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${actionMsg.type === 'success' ? 'bg-[var(--primary-light)]/90 text-[var(--primary)] border border-[var(--primary)]' : 'bg-[var(--loss-light)]/90 text-[var(--loss)] border border-[var(--loss)]'}`}>
          {actionMsg.type === 'error' ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)] rounded-xl p-4">
        <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> Managers ({managers.length})
        </h3>
        <DataTable
          columns={managerColumns}
          rows={managers}
          rowKey={(m: any) => m.id}
          emptyIcon={<Users className="w-6 h-6" />}
          emptyTitle="No managers found"
          emptyMessage="No staff with a manager-tier role exist yet."
        />
      </div>

      {selectedManagerId && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-[var(--bg-surface)]/80 border border-[var(--border-color)] rounded-xl p-4">
            <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>{selectedManager?.username}'s Book</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{assignments.length} customers</span>
            </h3>
            <DataTable
              isLoading={loadingAssignments}
              columns={[
                { key: 'customer', header: 'Customer', mobilePrimary: true, render: (a: any) => <div><div className="font-bold text-[var(--text-main)]">{a.username}</div><div className="text-[10px] text-[var(--text-tertiary)]">{a.email}</div></div> },
                { key: 'status', header: 'Status', render: (a: any) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'ACTIVE' ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'bg-[var(--loss-light)] text-[var(--loss)]'}`}>{a.status}</span> },
                { key: 'assignedAt', header: 'Assigned', mobileHidden: true, render: (a: any) => <span className="text-[10px] text-[var(--text-muted)] font-mono">{new Date(a.created_at).toLocaleDateString('en-IN')}</span> },
                {
                  key: 'action', header: '', align: 'center',
                  render: (a: any) => (
                    <button onClick={() => handleUnassign(a.user_id)} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--loss)]/15 text-[var(--loss)] hover:bg-[var(--loss)] hover:text-[var(--text-on-accent)] transition cursor-pointer">
                      <UserMinus className="w-3 h-3" /> Unassign
                    </button>
                  ),
                },
              ]}
              rows={assignments}
              rowKey={(a: any) => a.id}
              emptyIcon={<Users className="w-6 h-6" />}
              emptyTitle="No customers assigned"
              emptyMessage="This manager has no customers assigned to their book yet."
            />
          </div>

          <div className="lg:col-span-2 bg-[var(--bg-surface)]/80 border border-[var(--border-color)] rounded-xl p-4 h-fit">
            <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserPlus className="w-3.5 h-3.5" /> Assign a Customer
            </h3>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <input
                type="text" value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setAssignTargetUserId(''); }}
                placeholder="Search by username, email, or client ID..."
                className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            {customerResults.length > 0 && !assignTargetUserId && (
              <div className="border border-[var(--border-color)] rounded-lg overflow-hidden mb-3 max-h-40 overflow-y-auto">
                {customerResults.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => { setAssignTargetUserId(c.id); setCustomerSearch(`${c.username} (${c.email})`); setCustomerResults([]); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-elevated)] border-b border-[var(--border-color)] last:border-0 cursor-pointer"
                  >
                    <div className="font-bold text-[var(--text-main)]">{c.username}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">{c.email}</div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={handleAssign}
              disabled={!assignTargetUserId || submittingAssign}
              className="w-full flex items-center justify-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-[var(--text-on-accent)] font-bold text-xs py-2.5 rounded-lg transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" /> {submittingAssign ? 'Assigning...' : `Assign to ${selectedManager?.username || 'manager'}`}
            </button>
            <p className="text-[9px] text-[var(--text-tertiary)] mt-2">A customer can be assigned to more than one manager — each assignment is independent. Check Customer 360's profile tab to see every manager a customer is currently assigned to.</p>
          </div>
        </div>
      )}
    </div>
  );
};
