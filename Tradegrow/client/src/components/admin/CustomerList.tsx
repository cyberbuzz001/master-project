import React, { useState, useEffect, useRef } from 'react';
import { Search, Eye, Lock, Unlock, KeyRound, X, Check, Copy, RefreshCw, CheckCircle2, AlertTriangle, UserPlus, ShieldAlert, Phone, Mail, MoreVertical, UserX, UserCheck, Ban, ShieldOff, Edit2, ChevronLeft, ChevronRight, Users, Trash2 } from 'lucide-react';
import { DataTable, DataTableColumn } from '../ui/DataTable';

interface CustomerListProps { 
  token: string; 
  initialFilter?: string;
  onSelectCustomer: (id: string) => void; 
}

export const CustomerList: React.FC<CustomerListProps> = ({ token, initialFilter, onSelectCustomer }) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter || '');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialFilter !== undefined) {
      setStatusFilter(initialFilter);
      setPage(0);
    }
  }, [initialFilter]);

  // Password Reset Modal State
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Add Customer Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createClientId, setCreateClientId] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('USER');
  const [createInitialCapital, setCreateInitialCapital] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState<{ field: string; message: string; existingCustomer?: any } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Duplicate Identity Scanner State
  const [showDuplicateScanner, setShowDuplicateScanner] = useState(false);
  const [duplicateClusters, setDuplicateClusters] = useState<any | null>(null);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);

  // Action Dropdown & Confirm Dialog State
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    requireReason?: boolean;
    actionLabel: string;
    actionColor: string;
    onConfirm: (reason?: string) => void;
  } | null>(null);
  const [confirmReason, setConfirmReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Customer Modal State
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editRole, setEditRole] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchCustomers = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50', offset: String(page * 50) });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/v1/admin/customers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.success) { setCustomers(d.customers); setTotal(d.total); } })
      .finally(() => setLoading(false));
  };

  const fetchDuplicateClusters = () => {
    setLoadingDuplicates(true);
    fetch('/api/v1/admin/customers/duplicates', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) setDuplicateClusters(d.duplicates);
        setLoadingDuplicates(false);
      })
      .catch(() => setLoadingDuplicates(false));
  };

  useEffect(() => { fetchCustomers(); }, [token, search, statusFilter, page]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Action Helpers ──────────────────────────────────────────────────────
  const adminAction = async (endpoint: string, method: string, body?: object) => {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined
    });
    return res.json();
  };

  const showConfirm = (opts: typeof confirmDialog) => {
    setConfirmReason('');
    setActionMsg(null);
    setConfirmDialog(opts);
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    setActionLoading(true);
    try {
      await confirmDialog.onConfirm(confirmReason);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditModal = (c: any) => {
    setEditTarget(c);
    setEditFullName(c.full_name || '');
    setEditEmail(c.email || '');
    setEditPhone(c.phone_number || '');
    setEditAddress(c.address || '');
    setEditCity(c.city || '');
    setEditRole(c.role || 'USER');
    setEditMsg(null);
    setOpenDropdown(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSubmittingEdit(true);
    setEditMsg(null);
    try {
      const data = await adminAction(`/api/v1/admin/customers/${editTarget.id}`, 'PATCH', {
        fullName: editFullName,
        email: editEmail,
        phoneNumber: editPhone,
        address: editAddress,
        city: editCity,
        role: editRole
      });
      if (data.success) {
        setEditMsg({ type: 'success', text: 'Profile updated successfully.' });
        fetchCustomers();
        setTimeout(() => setEditTarget(null), 1500);
      } else {
        setEditMsg({ type: 'error', text: data.error?.message || 'Update failed' });
      }
    } catch {
      setEditMsg({ type: 'error', text: 'Network error' });
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleSuspend = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Suspend Account — ${c.username}`,
      message: `Suspending will block all trading and login for this customer. This action is fully reversible.`,
      requireReason: true,
      actionLabel: 'Confirm Suspend',
      actionColor: 'bg-[var(--warning)] hover:bg-[var(--warning)]',
      onConfirm: async (reason) => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}/suspend`, 'POST', { reason });
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 1500);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Failed to suspend' });
        }
      }
    });
  };

  const handleActivate = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Activate Account — ${c.username}`,
      message: `This will restore full trading access for ${c.username}. Current status: ${c.status}.`,
      actionLabel: 'Confirm Activate',
      actionColor: 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
      onConfirm: async () => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}/activate`, 'POST', {});
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 1500);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Failed to activate' });
        }
      }
    });
  };

  const handleLock = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Lock Account — ${c.username}`,
      message: `Locking places a security hold on the account. User cannot login or trade.`,
      requireReason: true,
      actionLabel: 'Confirm Lock',
      actionColor: 'bg-[var(--info)] hover:bg-[var(--info)]',
      onConfirm: async (reason) => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}/lock`, 'POST', { reason });
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 1500);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Failed to lock' });
        }
      }
    });
  };

  const handleUnlock = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Unlock Account — ${c.username}`,
      message: `Unlocking will restore the account to ACTIVE status.`,
      actionLabel: 'Confirm Unlock',
      actionColor: 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
      onConfirm: async () => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}/unlock`, 'POST', {});
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 1500);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Failed to unlock' });
        }
      }
    });
  };

  const handleCloseAccount = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Close Account — ${c.username}`,
      message: `⚠️ This permanently closes the account. All data is preserved but trading will be blocked. Requires zero open positions and zero used margin. Only SUPER_ADMIN can perform this action.`,
      requireReason: true,
      actionLabel: 'Confirm Close Account',
      actionColor: 'bg-[var(--loss)] hover:bg-[var(--loss)]',
      onConfirm: async (reason) => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}/close`, 'POST', { reason, confirmClose: true });
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 2000);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Cannot close account' });
        }
      }
    });
  };

  const handleDeleteCustomer = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Delete Customer Account — ${c.username}`,
      message: `⚠️ Are you sure you want to permanently delete customer account "${c.username}" (${c.email || c.client_id})? This will delete the user, wallet, and all related test/demo data completely. This action cannot be undone.`,
      requireReason: false,
      actionLabel: 'Permanently Delete Account',
      actionColor: 'bg-rose-600 hover:bg-rose-700',
      onConfirm: async () => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}`, 'DELETE');
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message || 'Account deleted successfully' });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 1500);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Cannot delete account' });
        }
      }
    });
  };

  // Debounced real-time duplicate validation check
  useEffect(() => {
    if (!showCreateModal) {
      setDuplicateWarning(null);
      return;
    }

    const trimmedEmail = createEmail.trim();
    const trimmedUsername = createUsername.trim();
    const trimmedClientId = createClientId.trim();

    if (!trimmedEmail && !trimmedUsername && !trimmedClientId) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(() => {
      setCheckingDuplicate(true);
      const params = new URLSearchParams();
      if (trimmedEmail) params.set('email', trimmedEmail);
      if (trimmedUsername) params.set('username', trimmedUsername);
      if (trimmedClientId) params.set('clientId', trimmedClientId);

      fetch(`/api/v1/admin/customers/check-duplicate?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          if (d.success && d.isDuplicate) {
            setDuplicateWarning({
              field: d.field,
              message: d.message,
              existingCustomer: d.existingCustomer
            });
          } else {
            setDuplicateWarning(null);
          }
          setCheckingDuplicate(false);
        })
        .catch(() => setCheckingDuplicate(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [createEmail, createUsername, createClientId, showCreateModal]);

  const handleGenerateClientId = () => {
    const randomHex = Math.random().toString(16).substring(2, 6).toUpperCase();
    setCreateClientId(`TG-USR-${randomHex}`);
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setCreateUsername('');
    setCreateEmail('');
    handleGenerateClientId();
    setCreateFullName('');
    setCreatePhone('');
    setCreatePassword('TG@' + Math.random().toString(36).slice(-6) + '#9');
    setCreateRole('USER');
    setCreateInitialCapital(0);
    setDuplicateWarning(null);
    setCreateMsg(null);
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicateWarning) return;
    setSubmittingCreate(true);
    setCreateMsg(null);

    try {
      const res = await fetch('/api/v1/admin/customers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: createUsername,
          email: createEmail,
          clientId: createClientId,
          fullName: createFullName,
          phoneNumber: createPhone,
          password: createPassword,
          role: createRole,
          initialCapital: createInitialCapital
        })
      });
      const data = await res.json();
      if (data.success) {
        setCreateMsg({ type: 'success', text: data.message || 'Customer created successfully!' });
        fetchCustomers();
        setTimeout(() => {
          setShowCreateModal(false);
        }, 1500);
      } else {
        setCreateMsg({ type: 'error', text: data.error?.message || 'Failed to create customer' });
      }
    } catch (err: any) {
      setCreateMsg({ type: 'error', text: err.message || 'Network error while creating customer' });
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleFreeze = async (id: string) => {
    await fetch(`/api/v1/admin/customers/${id}/freeze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: 'Admin action' })
    });
    fetchCustomers();
  };

  const handleUnfreeze = async (id: string) => {
    await fetch(`/api/v1/admin/customers/${id}/unfreeze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: 'Admin action' })
    });
    fetchCustomers();
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = 'TG@';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setCopied(false);
  };

  const handleOpenResetModal = (user: any) => {
    setResetTargetUser(user);
    setNewPassword('');
    setResetMsg(null);
    setCopied(false);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    if (!newPassword || newPassword.length < 6) {
      setResetMsg({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    setSubmittingReset(true);
    setResetMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/customers/${resetTargetUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setResetMsg({ type: 'success', text: data.message || 'Password successfully reset!' });
      } else {
        setResetMsg({ type: 'error', text: data.error?.message || data.message || 'Failed to reset password' });
      }
    } catch (err: any) {
      setResetMsg({ type: 'error', text: err.message || 'Network error while resetting password' });
    } finally {
      setSubmittingReset(false);
    }
  };

  const handleCopyPassword = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderActions = (c: any) => (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      {/* View 360 */}
      <button
        onClick={() => onSelectCustomer(c.id)}
        title="Open Customer 360 View"
        className="px-2 py-1 text-[11px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)] hover:text-[var(--text-on-accent)] border border-[var(--primary)]/30 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-sm"
      >
        <Eye className="w-3.5 h-3.5" />
        <span>360</span>
      </button>

      {/* Edit Profile Quick Button */}
      <button
        onClick={() => handleOpenEditModal(c)}
        title="Edit Profile & Role"
        className="p-1.5 text-[var(--info)] hover:text-[var(--info)] hover:bg-[var(--info)]/10 border border-[var(--border-color)] rounded-lg transition cursor-pointer"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>

      {/* Quick Activate Button if not Active */}
      {c.status !== 'ACTIVE' && c.status !== 'CLOSED' && (
        <button
          onClick={() => handleActivate(c)}
          title="Activate Account"
          className="px-2 py-1 text-[11px] font-bold text-[var(--primary)] bg-[var(--primary)]/15 hover:bg-[var(--primary)] hover:text-[var(--text-on-accent)] border border-[var(--primary)]/40 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-sm animate-pulse"
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Activate</span>
        </button>
      )}

      {/* Reset Password */}
      <button
        onClick={() => handleOpenResetModal(c)}
        title="Admin Reset Password"
        className="p-1.5 text-[var(--warning)]/90 hover:text-[var(--warning)] hover:bg-[var(--warning-light)]/40 border border-[var(--border-color)] rounded-lg transition cursor-pointer"
      >
        <KeyRound className="w-3.5 h-3.5" />
      </button>

      {/* More Actions Dropdown */}
      <div className="relative" ref={openDropdown === c.id ? dropdownRef : null} onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpenDropdown(openDropdown === c.id ? null : c.id);
          }}
          title="More Actions"
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg transition cursor-pointer"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {openDropdown === c.id && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-7 z-50 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl w-44 py-1 text-xs"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEditModal(c);
              }}
              className="w-full text-left px-3.5 py-2 text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2 cursor-pointer font-semibold"
            >
              <Edit2 className="w-3.5 h-3.5 text-[var(--info)]" /> Edit Profile & Role
            </button>
            <div className="my-1 border-t border-[var(--border-color)]" />
            {c.status !== 'ACTIVE' && c.status !== 'CLOSED' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleActivate(c);
                }}
                className="w-full text-left px-3.5 py-2 text-[var(--primary)] hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2 cursor-pointer font-bold"
              >
                <UserCheck className="w-3.5 h-3.5" /> Activate
              </button>
            )}
            {c.status === 'ACTIVE' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSuspend(c);
                }}
                className="w-full text-left px-3.5 py-2 text-[var(--warning)] hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2 cursor-pointer font-semibold"
              >
                <Ban className="w-3.5 h-3.5" /> Suspend
              </button>
            )}
            {c.status !== 'LOCKED' && c.status !== 'CLOSED' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLock(c);
                }}
                className="w-full text-left px-3.5 py-2 text-violet-400 hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" /> Lock (Security Hold)
              </button>
            )}
            {c.status === 'LOCKED' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnlock(c);
                }}
                className="w-full text-left px-3.5 py-2 text-[var(--info)] hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2 cursor-pointer font-bold"
              >
                <Unlock className="w-3.5 h-3.5" /> Unlock
              </button>
            )}
            {c.status !== 'CLOSED' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseAccount(c);
                }}
                className="w-full text-left px-3.5 py-2 text-[var(--warning)] hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2 cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" /> Close Account
              </button>
            )}
            <div className="my-1 border-t border-[var(--border-color)]" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCustomer(c);
              }}
              className="w-full text-left px-3.5 py-2 text-[var(--loss)] hover:bg-[var(--loss-light)] flex items-center gap-2 cursor-pointer font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Account
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const columns: DataTableColumn<any>[] = [
    {
      key: 'clientId',
      header: 'Client ID',
      className: 'min-w-[85px]',
      render: (c) => (
        <span className="font-mono text-[11px] text-[var(--warning)] font-bold">
          {c.client_id || `TG-USR-${c.id.slice(4, 8).toUpperCase()}`}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Client Name',
      mobilePrimary: true,
      className: 'min-w-[120px]',
      render: (c) => (
        <div>
          <div className="font-semibold text-[var(--text-main)]">{c.username}</div>
          {c.full_name && c.full_name !== c.username && (
            <div className="text-[10px] text-[var(--text-tertiary)] font-normal">{c.full_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email Address',
      className: 'min-w-[140px]',
      render: (c) => <span className="text-[var(--text-muted)] font-mono text-[11px] truncate max-w-[160px] block" title={c.email}>{c.email}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'min-w-[75px]',
      render: (c) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          c.status === 'ACTIVE' ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]' :
          c.status === 'FROZEN' ? 'bg-[var(--info-light)] text-[var(--info)] border border-[var(--info)]' :
          c.status === 'LOCKED' ? 'bg-violet-950 text-violet-400 border border-violet-800' :
          c.status === 'CLOSED' ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] border border-[var(--border-color)]' :
          'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]'
        }`}>{c.status}</span>
      ),
    },
    {
      key: 'kyc',
      header: 'KYC',
      className: 'min-w-[85px]',
      render: (c) => {
        const isApproved = c.kyc_status === 'APPROVED' || c.is_kyc_completed;
        const isRejected = c.kyc_status === 'REJECTED';
        const isPending = c.kyc_status === 'SUBMITTED' || c.kyc_status === 'UNDER_REVIEW' || c.kyc_status === 'RESUBMISSION_REQUIRED';
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            isApproved ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]' :
            isRejected ? 'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]' :
            isPending ? 'bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]' :
            'bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] border border-[var(--border-color)]'
          }`}>
            {isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : isPending ? 'PENDING' : 'UNVERIFIED'}
          </span>
        );
      },
    },
    {
      key: 'role',
      header: 'Role',
      className: 'min-w-[65px]',
      render: (c) => (
        <span className="bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded text-[10px] text-[var(--warning)] border border-[var(--border-color)] font-bold">{c.role}</span>
      ),
    },
    {
      key: 'funds',
      header: 'Funds (₹)',
      align: 'right',
      className: 'min-w-[90px]',
      render: (c) => <span className="font-mono font-bold text-[var(--primary)]">₹{(c.cash_balance || 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      mobileHidden: true,
      className: 'min-w-[195px] whitespace-nowrap',
      render: renderActions,
    },
  ];

  return (
    <div className="flex flex-col gap-4 h-full relative select-none">
      {/* Search, Filter & Action Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input 
            type="text" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search by Client ID (TG-USR-XXXX), Name, or Email..."
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-xs text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-[var(--primary)]" 
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          aria-label="Filter by account status"
          className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] font-semibold"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="FROZEN">Frozen</option>
          <option value="LOCKED">Locked</option>
          <option value="CLOSED">Closed</option>
          <option value="DISABLED">Disabled</option>
        </select>

        {/* Duplicate Identity Scanner Button */}
        <button
          onClick={() => { setShowDuplicateScanner(true); fetchDuplicateClusters(); }}
          className="bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--warning)]/40 text-[var(--warning)] font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          title="Scan Database for Duplicate Identities"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-[var(--warning)]" />
          <span>Duplicate Scanner</span>
        </button>

        {/* Add Customer Button */}
        <button
          onClick={handleOpenCreateModal}
          className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-on-accent)] font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ Add Customer</span>
        </button>

        <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{total} total</span>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-2xl flex-1 overflow-x-auto shadow-xl p-3">
        <DataTable
          columns={columns}
          rows={customers}
          rowKey={(c) => c.id}
          isLoading={loading}
          loadingRowCount={8}
          onRowClick={(c) => onSelectCustomer(c.id)}
          emptyIcon={<Users className="w-6 h-6" />}
          emptyTitle="No customers found"
          emptyMessage="Try adjusting your search or status filter, or add a new customer."
          renderMobileActions={renderActions}
        />
      </div>

      {/* Pagination Controls */}
      {total > 50 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
            Showing {page * 50 + 1}–{Math.min(page * 50 + 50, total)} of {total} customers
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] disabled:opacity-30 hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] transition cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-[var(--text-main)] px-1">Page {page + 1} / {Math.ceil(total / 50)}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * 50 >= total}
              className="p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] disabled:opacity-30 hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] transition cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIRM ACTION DIALOG ───────────────────────────────────────────── */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-[var(--text-main)]">{confirmDialog.title}</h3>
              <button onClick={() => setConfirmDialog(null)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{confirmDialog.message}</p>

            {confirmDialog.requireReason && (
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Reason / Notes *</label>
                <textarea
                  value={confirmReason}
                  onChange={e => setConfirmReason(e.target.value)}
                  rows={2}
                  placeholder="Provide a reason for this action..."
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs resize-none focus:outline-none focus:border-[var(--warning)]"
                />
              </div>
            )}

            {actionMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                actionMsg.type === 'success' ? 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30' : 'bg-[var(--loss)]/15 text-[var(--loss)] border border-[var(--loss)]/30'
              }`}>
                {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {actionMsg.text}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={actionLoading || (confirmDialog.requireReason && !confirmReason.trim())}
                className={`px-5 py-2 rounded-xl ${confirmDialog.actionColor} disabled:opacity-40 text-[var(--text-main)] font-black text-xs transition cursor-pointer`}
              >
                {actionLoading ? 'Processing...' : confirmDialog.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT CUSTOMER PROFILE MODAL ─────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[var(--info)]/10 text-[var(--info)] border border-[var(--info)]/20">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Edit Customer Profile</h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">{editTarget.client_id} — {editTarget.username}</p>
                </div>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg bg-[var(--bg-surface-elevated)]/80 hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Full Name</label>
                  <input value={editFullName} onChange={e => setEditFullName(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--info)]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Email</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] font-mono text-xs focus:outline-none focus:border-[var(--info)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Phone Number</label>
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--info)]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">City</label>
                  <input value={editCity} onChange={e => setEditCity(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--info)]" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Address</label>
                <input value={editAddress} onChange={e => setEditAddress(e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--info)]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs font-semibold focus:outline-none focus:border-[var(--info)]">
                  <option value="USER">USER (Standard Client)</option>
                  <option value="MANAGER">MANAGER (Client Account Oversight)</option>
                  <option value="FINANCE_MANAGER">FINANCE_MANAGER (Deposits & Ledgers)</option>
                  <option value="RISK_MANAGER">RISK_MANAGER (Exposure & Margins)</option>
                  <option value="OPERATIONS_MANAGER">OPERATIONS_MANAGER (Operations Oversight)</option>
                  <option value="KYC_OFFICER">KYC_OFFICER (KYC & Documents)</option>
                  <option value="DEALER">DEALER (Order Desk Execution)</option>
                  <option value="SUPPORT_AGENT">SUPPORT_AGENT (Customer Support)</option>
                  <option value="ANALYST">ANALYST (Market Research & Stats)</option>
                  <option value="READ_ONLY_AUDITOR">READ_ONLY_AUDITOR (Compliance Audit)</option>
                  <option value="ADMIN">ADMIN (System Administrator)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Full Platform Authority)</option>
                </select>
              </div>

              {editMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  editMsg.type === 'success' ? 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30' : 'bg-[var(--loss)]/15 text-[var(--loss)] border border-[var(--loss)]/30'
                }`}>
                  {editMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {editMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold text-xs cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submittingEdit}
                  className="px-5 py-2 rounded-xl bg-[var(--info)] hover:bg-[var(--info)] disabled:opacity-40 text-[var(--text-on-accent)] font-black text-xs transition cursor-pointer">
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE CUSTOMER MODAL WITH LIVE DUPLICATE CHECKER ─────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Create New Customer Account</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Strict unique email &amp; Client ID verification active</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg bg-[var(--bg-surface-elevated)]/80 hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Duplicate Warning Banner */}
            {duplicateWarning && (
              <div className="p-3.5 bg-[var(--warning)]/15 border border-[var(--warning)]/30 rounded-2xl text-[var(--warning)] text-xs space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-[var(--warning)] flex-shrink-0" />
                  <span>Duplicate Client Detected ({duplicateWarning.field.toUpperCase()})</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">{duplicateWarning.message}</p>
                {duplicateWarning.existingCustomer && (
                  <div className="bg-[var(--bg-body)]/80 p-2.5 rounded-xl border border-[var(--border-color)] font-mono text-[10px] space-y-1">
                    <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Existing Client ID:</span><span className="text-[var(--warning)] font-bold">{duplicateWarning.existingCustomer.clientId}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Username:</span><span className="text-[var(--text-main)] font-bold">{duplicateWarning.existingCustomer.username}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Status:</span><span className="text-[var(--primary)]">{duplicateWarning.existingCustomer.status}</span></div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleCreateCustomerSubmit} className="space-y-3.5 text-xs">
              {/* Email Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Email Address *</label>
                  {checkingDuplicate && <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Checking uniqueness...</span>}
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="client@gmail.com"
                    value={createEmail}
                    onChange={e => setCreateEmail(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl pl-9 pr-3.5 py-2 text-[var(--text-main)] font-mono text-xs focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              {/* Client ID & Username */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Client ID *</label>
                    <button
                      type="button"
                      onClick={handleGenerateClientId}
                      className="text-[10px] font-bold text-[var(--warning)] hover:text-[var(--warning)] flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={createClientId}
                    onChange={e => setCreateClientId(e.target.value.toUpperCase())}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--warning)] font-mono font-bold text-xs focus:outline-none focus:border-[var(--warning)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="pravinbhai"
                    value={createUsername}
                    onChange={e => setCreateUsername(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] font-semibold text-xs focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              {/* Full Name & Phone Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="Pravin Bhai"
                    value={createFullName}
                    onChange={e => setCreateFullName(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={createPhone}
                    onChange={e => setCreatePhone(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              {/* Password & Role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Password *</label>
                  <input
                    type="text"
                    required
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] font-mono text-xs focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Role</label>
                  <select
                    value={createRole}
                    onChange={e => setCreateRole(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs font-semibold"
                  >
                    <option value="USER">USER (Standard Client)</option>
                    <option value="MANAGER">MANAGER (Client Account Oversight)</option>
                    <option value="FINANCE_MANAGER">FINANCE_MANAGER (Deposits & Ledgers)</option>
                    <option value="RISK_MANAGER">RISK_MANAGER (Exposure & Margins)</option>
                    <option value="OPERATIONS_MANAGER">OPERATIONS_MANAGER (Operations Oversight)</option>
                    <option value="KYC_OFFICER">KYC_OFFICER (KYC & Documents)</option>
                    <option value="DEALER">DEALER (Order Desk Execution)</option>
                    <option value="SUPPORT_AGENT">SUPPORT_AGENT (Customer Support)</option>
                    <option value="ANALYST">ANALYST (Market Research & Stats)</option>
                    <option value="READ_ONLY_AUDITOR">READ_ONLY_AUDITOR (Compliance Audit)</option>
                    <option value="ADMIN">ADMIN (System Administrator)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Full Platform Authority)</option>
                  </select>
                </div>
              </div>

              {/* Initial Capital */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Initial Wallet Capital (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={createInitialCapital}
                  onChange={e => setCreateInitialCapital(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--primary)] font-mono font-bold text-xs focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {createMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  createMsg.type === 'success' ? 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30' : 'bg-[var(--loss)]/15 text-[var(--loss)] border border-[var(--loss)]/30'
                }`}>
                  {createMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {createMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate || !!duplicateWarning || !createEmail || !createUsername}
                  className="px-5 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-[var(--text-on-accent)] font-black text-xs transition shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  {submittingCreate ? 'Validating & Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── DUPLICATE IDENTITY SCANNER MODAL ─────────────────────────────── */}
      {showDuplicateScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Duplicate Identity Audit Scanner</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Automated detection of shared emails, phones, and PAN identities</p>
                </div>
              </div>
              <button
                onClick={() => setShowDuplicateScanner(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg bg-[var(--bg-surface-elevated)]/80 hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDuplicates ? (
              <div className="py-12 text-center text-[var(--text-muted)] text-xs">Scanning database identities...</div>
            ) : duplicateClusters && (
              <div className="space-y-4 text-xs">
                {/* Duplicate Emails Cluster */}
                <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border-color)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[var(--warning)]" />
                      Duplicate Email Groups ({(duplicateClusters.byEmail || []).length})
                    </span>
                  </div>

                  {(duplicateClusters.byEmail || []).length === 0 ? (
                    <p className="text-[11px] text-[var(--primary)] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Zero duplicate emails detected. Database uniqueness verified!</p>
                  ) : (
                    <div className="space-y-2">
                      {duplicateClusters.byEmail.map((item: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1">
                          <div className="font-mono text-[var(--warning)] font-bold">{item.norm_email} ({item.count} accounts)</div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">User IDs: {item.user_ids?.join(', ')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Duplicate Phone Numbers */}
                <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border-color)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[var(--warning)]" />
                      Duplicate Phone Number Clusters ({(duplicateClusters.byPhone || []).length})
                    </span>
                  </div>

                  {(duplicateClusters.byPhone || []).length === 0 ? (
                    <p className="text-[11px] text-[var(--primary)] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> No shared phone numbers found across accounts.</p>
                  ) : (
                    <div className="space-y-2">
                      {duplicateClusters.byPhone.map((item: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-1">
                          <div className="font-mono text-[var(--warning)] font-bold">Phone: {item.phone_number} ({item.count} accounts)</div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">Usernames: {item.usernames?.join(', ')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDuplicateScanner(false)}
                className="px-4 py-2 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold text-xs cursor-pointer"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN RESET PASSWORD MODAL ───────────────────────────────────── */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Admin Password Reset</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Set a new password for client login</p>
                </div>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg bg-[var(--bg-surface-elevated)]/80 hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target User Card */}
            <div className="bg-[var(--bg-body)] p-3.5 rounded-xl border border-[var(--border-color)] space-y-1 font-mono text-xs">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Client ID:</span>
                <span className="text-[var(--primary)] font-bold">{resetTargetUser.client_id || `TG-${resetTargetUser.id.slice(0, 8).toUpperCase()}`}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Username:</span>
                <span className="text-[var(--text-main)] font-bold">{resetTargetUser.username}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Email:</span>
                <span className="text-[var(--text-muted)]">{resetTargetUser.email}</span>
              </div>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">New Password *</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[10px] font-bold text-[var(--warning)] hover:text-[var(--warning)] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Auto-Generate Strong
                  </button>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-[var(--text-main)] font-mono text-xs focus:outline-none focus:border-[var(--warning)] pr-10"
                  />
                  {newPassword && (
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                      title="Copy Password"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[var(--primary)]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {resetMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  resetMsg.type === 'success' ? 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30' : 'bg-[var(--loss)]/15 text-[var(--loss)] border border-[var(--loss)]/30'
                }`}>
                  {resetMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {resetMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReset || !newPassword || newPassword.length < 6}
                  className="px-5 py-2 rounded-xl bg-[var(--warning)] hover:bg-[var(--warning)] disabled:opacity-50 text-[var(--text-on-accent)] font-black text-xs transition shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  {submittingReset ? 'Updating Password...' : 'Confirm Reset Password'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};
