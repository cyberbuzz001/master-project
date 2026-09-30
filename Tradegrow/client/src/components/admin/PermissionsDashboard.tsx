import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Users, Key, CheckCircle2, XCircle, AlertTriangle, Search,
  RefreshCw, Lock, Unlock, Save, Settings2, Sliders, Check, X,
  FileCheck, DollarSign, Activity, Eye, ChevronRight, UserCheck, Sparkles, Filter
} from 'lucide-react';
import { DataTable, DataTableColumn } from '../ui/DataTable';

interface PermissionsDashboardProps {
  token: string;
}

interface PermissionItem {
  key: string;
  label: string;
  description: string;
  defaultRoles: string[];
}

interface PermissionCategory {
  category: string;
  description: string;
  permissions: PermissionItem[];
}

interface UserAccount {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  role: string;
  status: string;
  is_kyc_completed: boolean;
  created_at: string;
  max_users: number;
  max_exposure_per_user: number;
  max_deposit_approval: number;
  max_withdrawal_approval: number;
  max_daily_loss_cap: number;
  assigned_users_count: number;
  customPermissions: Record<string, boolean>;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: 'bg-[var(--loss)]/15', text: 'text-[var(--loss)]', border: 'border-[var(--loss)]/30' },
  ADMIN: { bg: 'bg-[var(--put-accent)]/15', text: 'text-[var(--put-accent)]', border: 'border-[var(--put-accent)]/30' },
  MANAGER: { bg: 'bg-[var(--info)]/15', text: 'text-[var(--info)]', border: 'border-[var(--info)]/30' },
  FINANCE_MANAGER: { bg: 'bg-[var(--primary)]/15', text: 'text-[var(--primary)]', border: 'border-[var(--primary)]/30' },
  RISK_MANAGER: { bg: 'bg-[var(--warning)]/15', text: 'text-[var(--warning)]', border: 'border-[var(--warning)]/30' },
  OPERATIONS_MANAGER: { bg: 'bg-[var(--gogrow-blue)]/15', text: 'text-[var(--gogrow-blue)]', border: 'border-[var(--gogrow-blue)]/30' },
  KYC_OFFICER: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  DEALER: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  SUPPORT_AGENT: { bg: 'bg-[var(--info)]/15', text: 'text-[var(--info)]', border: 'border-[var(--info)]/30' },
  ANALYST: { bg: 'bg-[var(--warning)]/15', text: 'text-[var(--warning)]', border: 'border-[var(--warning)]/30' },
  READ_ONLY_AUDITOR: { bg: 'bg-[var(--bg-surface-elevated)]/15', text: 'text-[var(--text-muted)]', border: 'border-[var(--border-color)]/30' },
  USER: { bg: 'bg-[var(--bg-surface-elevated)]/40', text: 'text-[var(--text-muted)]', border: 'border-[var(--border-color)]/50' },
};

const ALL_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER',
  'OPERATIONS_MANAGER', 'KYC_OFFICER', 'DEALER', 'SUPPORT_AGENT', 'ANALYST',
  'READ_ONLY_AUDITOR', 'USER'
];

export const PermissionsDashboard: React.FC<PermissionsDashboardProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'MATRIX'>('USERS');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [categories, setCategories] = useState<PermissionCategory[]>([]);
  const [roles, setRoles] = useState<string[]>(ALL_ROLES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  
  // Selected user for editing permissions
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [editRole, setEditRole] = useState<string>('USER');
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [editLimits, setEditLimits] = useState({
    maxUsers: 100,
    maxExposurePerUser: 1000000,
    maxDepositApproval: 50000,
    maxWithdrawalApproval: 25000,
    maxDailyLossCap: 100000
  });
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch users and permission matrix
  const fetchData = async () => {
    setLoading(true);
    try {
      const [matrixRes, usersRes] = await Promise.all([
        fetch('/api/v1/admin/permissions/matrix', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/admin/permissions/users', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const matrixData = await matrixRes.json();
      const usersData = await usersRes.json();

      if (matrixData.success) {
        setCategories(matrixData.categories || []);
        if (matrixData.roles) setRoles(matrixData.roles);
      }

      if (usersData.success) {
        setUsers(usersData.users || []);
      }
    } catch (err: any) {
      console.error('Failed to load permissions data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Open modal / panel for user
  const handleSelectUser = (user: UserAccount) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditPerms({ ...(user.customPermissions || {}) });
    setEditLimits({
      maxUsers: user.max_users || 100,
      maxExposurePerUser: user.max_exposure_per_user || 1000000,
      maxDepositApproval: user.max_deposit_approval || 50000,
      maxWithdrawalApproval: user.max_withdrawal_approval || 25000,
      maxDailyLossCap: user.max_daily_loss_cap || 100000
    });
    setAlertMsg(null);
  };

  // Helper to determine if a permission is effectively granted for a user
  const isPermissionEffective = (user: UserAccount, perm: PermissionItem) => {
    if (user.customPermissions && user.customPermissions[perm.key] !== undefined) {
      return user.customPermissions[perm.key];
    }
    return perm.defaultRoles.includes(user.role);
  };

  const isPermissionEffectiveForEdit = (perm: PermissionItem) => {
    if (editPerms[perm.key] !== undefined) {
      return editPerms[perm.key];
    }
    return perm.defaultRoles.includes(editRole);
  };

  const handleTogglePerm = (key: string) => {
    const currentEffective = editPerms[key] !== undefined 
      ? editPerms[key] 
      : categories.flatMap(c => c.permissions).find(p => p.key === key)?.defaultRoles.includes(editRole) || false;
    
    setEditPerms(prev => ({
      ...prev,
      [key]: !currentEffective
    }));
  };

  const handleResetToRoleDefaults = () => {
    setEditPerms({});
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setAlertMsg(null);

    try {
      const res = await fetch('/api/v1/admin/permissions/save-user-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: editRole,
          permissions: editPerms,
          limits: editLimits
        })
      });

      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message || 'Permissions updated successfully!' });
        await fetchData();
        setTimeout(() => {
          setSelectedUser(null);
        }, 1200);
      } else {
        setAlertMsg({ type: 'error', text: data.error?.message || 'Failed to update permissions' });
      }
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase())) ||
        u.id.toLowerCase().includes(search.toLowerCase());
      
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const staffCount = useMemo(() => {
    return users.filter(u => u.role !== 'USER').length;
  }, [users]);

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1 text-[var(--text-main)] select-none">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-[var(--bg-surface)]/90 via-[var(--bg-surface)]/60 to-[var(--bg-surface)]/90 border border-[var(--border-color)] shadow-2xl backdrop-blur-xl gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[var(--info)]/20 to-[var(--gogrow-blue)]/20 border border-[var(--info)]/30 text-[var(--info)] shadow-inner">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-extrabold text-[var(--text-main)] tracking-wide">
                ROLES & PERMISSIONS CONTROL CENTER
              </h1>
              <span className="text-[10px] font-bold text-[var(--info)] bg-[var(--info)]/10 px-2.5 py-0.5 rounded-full border border-[var(--info)]/20 uppercase tracking-wider">
                RBAC Active
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Granular access policies, custom staff overrides & multi-tier supervisory limits
            </p>
          </div>
        </div>

        {/* Tab Controls & Refresh */}
        <div className="flex items-center gap-2.5 self-stretch md:self-auto justify-between md:justify-end">
          <div className="flex bg-[var(--bg-body)]/80 p-1 rounded-xl border border-[var(--border-color)]">
            <button
              onClick={() => setActiveTab('USERS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'USERS'
                  ? 'bg-[var(--info)] text-[var(--text-on-accent)] shadow-lg'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Staff & User Access ({filteredUsers.length})
            </button>
            <button
              onClick={() => setActiveTab('MATRIX')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'MATRIX'
                  ? 'bg-[var(--info)] text-[var(--text-on-accent)] shadow-lg'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Permission Matrix
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-[var(--bg-surface-elevated)]/80 hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]/60 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--info)]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Top Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)]/60 border border-[var(--border-color)]/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Total Accounts</div>
            <div className="text-lg font-black text-[var(--text-main)] mt-0.5">{users.length}</div>
          </div>
          <Users className="w-5 h-5 text-[var(--text-tertiary)]" />
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)]/60 border border-[var(--border-color)]/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Staff / Officers</div>
            <div className="text-lg font-black text-[var(--info)] mt-0.5">{staffCount}</div>
          </div>
          <UserCheck className="w-5 h-5 text-[var(--info)]/70" />
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)]/60 border border-[var(--border-color)]/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Standard Clients</div>
            <div className="text-lg font-black text-[var(--primary)] mt-0.5">{users.length - staffCount}</div>
          </div>
          <Users className="w-5 h-5 text-[var(--primary)]/70" />
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)]/60 border border-[var(--border-color)]/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Granular Policies</div>
            <div className="text-lg font-black text-[var(--gogrow-blue)] mt-0.5">
              {categories.reduce((acc, cat) => acc + cat.permissions.length, 0)} Rules
            </div>
          </div>
          <Key className="w-5 h-5 text-[var(--gogrow-blue)]/70" />
        </div>
      </div>

      {/* 3. TAB CONTENT */}
      {activeTab === 'USERS' ? (
        <div className="flex flex-col gap-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--bg-surface)]/80 rounded-xl border border-[var(--border-color)]">
            <div className="flex-1 min-w-[260px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by username, email, full name, or Client ID..."
                className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl pl-9 pr-4 py-2 text-xs text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-[var(--info)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
                className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--info)]"
              >
                <option value="ALL">All Roles</option>
                {roles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* User List Table */}
          <div className="bg-[var(--bg-surface)]/60 rounded-xl border border-[var(--border-color)] overflow-hidden p-3">
            <DataTable
              columns={[
                {
                  key: 'user', header: 'User / Staff', mobilePrimary: true,
                  render: (user: UserAccount) => (
                    <div>
                      <div className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                        {user.full_name || user.username}
                        {user.role !== 'USER' && <Shield className="w-3 h-3 text-[var(--info)] shrink-0" />}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)]">{user.email}</div>
                    </div>
                  ),
                },
                {
                  key: 'role', header: 'Role',
                  render: (user: UserAccount) => {
                    const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.USER;
                    return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>{user.role}</span>;
                  },
                },
                {
                  key: 'status', header: 'Account Status',
                  render: (user: UserAccount) => (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${user.status === 'ACTIVE' ? 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20' : 'bg-[var(--loss)]/10 text-[var(--loss)] border border-[var(--loss)]/20'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-[var(--primary)]' : 'bg-[var(--loss)]'}`} />
                      {user.status}
                    </span>
                  ),
                },
                {
                  key: 'overrides', header: 'Custom Overrides',
                  render: (user: UserAccount) => {
                    const customPermCount = Object.keys(user.customPermissions || {}).length;
                    return customPermCount > 0 ? (
                      <span className="text-[11px] font-bold text-[var(--warning)] bg-[var(--warning)]/10 border border-[var(--warning)]/20 px-2 py-0.5 rounded-md flex items-center gap-1 w-fit">
                        <Sparkles className="w-3 h-3" />
                        {customPermCount} Custom Override{customPermCount > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-tertiary)] font-medium">Inherits Role Defaults</span>
                    );
                  },
                },
                {
                  key: 'limits', header: 'Manager Limits', mobileHidden: true,
                  render: (user: UserAccount) => ['MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER', 'ADMIN'].includes(user.role) ? (
                    <div className="text-[10px] font-mono text-[var(--text-muted)]">
                      <div>Max Users: <span className="font-bold text-[var(--text-main)]">{user.max_users}</span></div>
                      <div className="text-[var(--text-muted)]">Dep: ₹{Number(user.max_deposit_approval).toLocaleString()} | Wdr: ₹{Number(user.max_withdrawal_approval).toLocaleString()}</div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[var(--text-tertiary)]">—</span>
                  ),
                },
                {
                  key: 'actions', header: 'Actions', align: 'right', mobileHidden: true,
                  render: (user: UserAccount) => (
                    <button onClick={() => handleSelectUser(user)} className="px-3 py-1.5 rounded-xl bg-[var(--info)]/20 hover:bg-[var(--info)] text-[var(--info)] hover:text-[var(--text-on-accent)] border border-[var(--info)]/30 text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer">
                      <Settings2 className="w-3.5 h-3.5" />
                      Configure Permissions
                    </button>
                  ),
                },
              ]}
              rows={filteredUsers}
              rowKey={(user: UserAccount) => user.id}
              isLoading={loading}
              renderMobileActions={(user: UserAccount) => (
                <button onClick={() => handleSelectUser(user)} className="px-3 py-1.5 rounded-xl bg-[var(--info)]/20 hover:bg-[var(--info)] text-[var(--info)] hover:text-[var(--text-on-accent)] border border-[var(--info)]/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
                  <Settings2 className="w-3.5 h-3.5" />
                  Configure Permissions
                </button>
              )}
              emptyIcon={<Users className="w-6 h-6" />}
              emptyTitle="No accounts found"
              emptyMessage="No accounts match the current filter."
            />
          </div>
        </div>
      ) : (
        /* 4. PERMISSION MATRIX TAB */
        <div className="flex flex-col gap-4">
          <div className="bg-[var(--bg-surface)]/60 rounded-xl border border-[var(--border-color)] p-4">
            <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2 mb-1">
              <Sliders className="w-4 h-4 text-[var(--info)]" />
              Role-Based Access Control (RBAC) System Matrix
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Baseline system permissions granted by default to each administrative and customer role. Custom overrides can be set per user in the Staff & User Access tab.
            </p>

            {/* This is a role×permission matrix with dynamic per-role columns and grouped
                category headings — not a fit for DataTable's fixed-columns/flat-rows model in
                one instance. Split into one DataTable per category instead: preserves the
                category grouping as section headings, and each still gets DataTable's mobile
                stacked-card fallback (previously this whole matrix only had overflow-x-auto,
                meaning scrolling through 13 role columns sideways on a phone). */}
            <div className="space-y-5">
              {categories.map((cat, catIdx) => {
                const roleColumns: DataTableColumn<PermissionItem>[] = roles.map(role => ({
                  key: role,
                  header: role.replace('_', ' '),
                  align: 'center' as const,
                  render: (perm: PermissionItem) => perm.defaultRoles.includes(role) ? (
                    <span className="inline-flex p-1 rounded bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="inline-flex p-1 rounded bg-[var(--bg-surface)] text-[var(--text-tertiary)]">
                      <X className="w-3.5 h-3.5" />
                    </span>
                  ),
                }));

                return (
                  <div key={cat.category}>
                    <div className="text-[11px] font-black text-[var(--info)] uppercase tracking-wider mb-2">
                      {catIdx + 1}. {cat.category}
                      <span className="text-[10px] font-normal text-[var(--text-tertiary)] ml-2 normal-case">({cat.description})</span>
                    </div>
                    <DataTable
                      columns={[
                        {
                          key: 'capability', header: 'Capability / Permission Key', mobilePrimary: true,
                          render: (perm: PermissionItem) => (
                            <div>
                              <div className="font-bold text-[var(--text-main)] text-xs">{perm.label}</div>
                              <div className="text-[10px] text-[var(--text-tertiary)] font-mono">{perm.key}</div>
                            </div>
                          ),
                        },
                        ...roleColumns,
                      ]}
                      rows={cat.permissions}
                      rowKey={(perm: PermissionItem) => perm.key}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: USER PERMISSIONS & ROLE CONFIGURATION MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-backdrop)] backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-body)]/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[var(--info)]/20 border border-[var(--info)]/30 text-[var(--info)]">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-2">
                    Configure Access & Permissions
                    <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded">
                      {selectedUser.username}
                    </span>
                  </h2>
                  <p className="text-[11px] text-[var(--text-muted)]">{selectedUser.email} — {selectedUser.full_name || 'No full name'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              
              {/* Alert Message */}
              {alertMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  alertMsg.type === 'success'
                    ? 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30'
                    : 'bg-[var(--loss)]/15 text-[var(--loss)] border border-[var(--loss)]/30'
                }`}>
                  {alertMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  {alertMsg.text}
                </div>
              )}

              {/* Role Selection */}
              <div className="p-4 rounded-xl bg-[var(--bg-body)]/60 border border-[var(--border-color)] space-y-2">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                  Assigned Platform Role
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-[var(--text-main)] font-bold text-xs focus:outline-none focus:border-[var(--info)]"
                  >
                    {roles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="text-[11px] text-[var(--text-muted)] flex items-center">
                    Selecting a new role resets baseline capabilities. You can still customize granular permissions below.
                  </div>
                </div>
              </div>

              {/* Manager Capacity Limits (shown for staff/manager roles) */}
              {['MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(editRole) && (
                <div className="p-4 rounded-xl bg-[var(--bg-body)]/60 border border-[var(--border-color)] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[var(--info)]" />
                      Manager Capacity & Approval Thresholds
                    </h4>
                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-mono">Real-Money Sim Safe Limits</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] font-bold mb-1">Max Clients Assigned</label>
                      <input
                        type="number"
                        min="1"
                        value={editLimits.maxUsers}
                        onChange={e => setEditLimits({ ...editLimits, maxUsers: parseInt(e.target.value) || 100 })}
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-[var(--text-main)] font-mono text-xs focus:outline-none focus:border-[var(--info)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] font-bold mb-1">Max Deposit Approval (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="5000"
                        value={editLimits.maxDepositApproval}
                        onChange={e => setEditLimits({ ...editLimits, maxDepositApproval: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-[var(--text-main)] font-mono text-xs focus:outline-none focus:border-[var(--info)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] font-bold mb-1">Max Withdrawal Cap (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="5000"
                        value={editLimits.maxWithdrawalApproval}
                        onChange={e => setEditLimits({ ...editLimits, maxWithdrawalApproval: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-[var(--text-main)] font-mono text-xs focus:outline-none focus:border-[var(--info)]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Granular Permission Toggles by Category */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-[var(--warning)]" />
                    Granular Permission Controls
                  </h4>
                  <button
                    type="button"
                    onClick={handleResetToRoleDefaults}
                    className="text-[11px] text-[var(--info)] hover:text-[var(--info)] font-bold cursor-pointer transition underline"
                  >
                    Reset to Role Defaults
                  </button>
                </div>

                {categories.map((cat) => (
                  <div key={cat.category} className="p-3.5 rounded-xl bg-[var(--bg-body)]/40 border border-[var(--border-color)] space-y-2.5">
                    <div className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--info)]" />
                      {cat.category}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {cat.permissions.map((perm) => {
                        const isGranted = isPermissionEffectiveForEdit(perm);
                        const isOverridden = editPerms[perm.key] !== undefined;

                        return (
                          <div
                            key={perm.key}
                            onClick={() => handleTogglePerm(perm.key)}
                            className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition ${
                              isGranted
                                ? 'bg-[var(--info)]/10 border-[var(--info)]/30 hover:border-[var(--info)]/60'
                                : 'bg-[var(--bg-surface)]/60 border-[var(--border-color)]/80 hover:border-[var(--border-color)] opacity-60'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold text-xs ${isGranted ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                                  {perm.label}
                                </span>
                                {isOverridden && (
                                  <span className="text-[9px] bg-[var(--warning)]/20 text-[var(--warning)] border border-[var(--warning)]/30 px-1.5 rounded font-mono font-bold">
                                    Override
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 leading-tight">
                                {perm.description}
                              </p>
                            </div>

                            {/* Toggle Switch */}
                            <div className={`w-8 h-4 rounded-full transition-colors relative mt-0.5 shrink-0 ${
                              isGranted ? 'bg-[var(--info)]' : 'bg-[var(--bg-surface-elevated)]'
                            }`}>
                              <div className={`w-3 h-3 rounded-full bg-white transition-transform absolute top-0.5 ${
                                isGranted ? 'left-4.5' : 'left-0.5'
                              }`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-body)]/80">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[var(--info)] hover:bg-[var(--info)] disabled:opacity-50 text-[var(--text-on-accent)] font-black text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Role & Permissions
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
