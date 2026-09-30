import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Flame,
  Download,
  Zap,
  MoreVertical,
  X,
  Ban,
  Lock,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { CustomerHoverCard } from './CustomerHoverCard';
import { exportToCsv } from '../../utils/csvExport';

interface RiskCommandCenterProps {
  token: string;
  onOpenCustomer360?: (userId: string) => void;
}

export const RiskCommandCenter: React.FC<RiskCommandCenterProps> = ({ token, onOpenCustomer360 }) => {
  const [risk, setRisk] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  const fetchRiskData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/risk/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.success) setRisk(d.risk);
    } catch (err: any) {
      console.error('Failed to fetch risk dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (id: string) => {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/v1/admin/risk/alerts/${id}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setRisk((prev: any) =>
          prev
            ? {
                ...prev,
                marginAlerts: (prev.marginAlerts || []).filter((a: any) => a.id !== id),
                rmsBlocks: (prev.rmsBlocks || []).filter((b: any) => b.id !== id),
              }
            : prev
        );
        setFeedback({ type: 'success', message: 'Risk event marked resolved.' });
      } else {
        setFeedback({ type: 'error', message: data.error?.message || 'Failed to resolve risk event' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error' });
    } finally {
      setResolvingId(null);
    }
  };

  // Quick Resolve: Cancels resting orders & synchronizes margin
  const handleQuickResolve = async (client: any) => {
    const clientId = client.id || client.user_id;
    setActionLoadingId(clientId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/admin/risk/clients/${clientId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cancelOrders: true,
          squareOffPositions: false,
          resetMargin: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: data.message || `Risk resolved for ${client.username}.`,
        });
        await fetchRiskData();
      } else {
        setFeedback({
          type: 'error',
          message: data.error?.message || 'Failed to resolve client risk',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Sync / Heal all margins platform-wide
  const handleSyncAllMargins = async () => {
    if (!window.confirm('Recalculate and synchronize margin requirements for all high-risk accounts across the platform?')) {
      return;
    }
    setSyncingAll(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/v1/admin/risk/sync-all-margins', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: data.message || 'Platform-wide margin synchronization complete.',
        });
        await fetchRiskData();
      } else {
        setFeedback({
          type: 'error',
          message: data.error?.message || 'Failed to synchronize margins',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error' });
    } finally {
      setSyncingAll(false);
    }
  };

  // Detailed actions from Modal
  const handleExecuteAction = async (actionType: 'RESOLVE' | 'CANCEL_ORDERS' | 'SQUARE_OFF_ALL' | 'SYNC_MARGIN' | 'FREEZE') => {
    if (!selectedClient) return;
    const clientId = selectedClient.id || selectedClient.user_id;
    setActionLoadingId(clientId);
    setFeedback(null);

    try {
      let res: any;
      if (actionType === 'RESOLVE') {
        res = await fetch(`/api/v1/admin/risk/clients/${clientId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ cancelOrders: true, squareOffPositions: false }),
        });
      } else if (actionType === 'CANCEL_ORDERS') {
        res = await fetch(`/api/v1/admin/risk/clients/${clientId}/cancel-orders`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else if (actionType === 'SQUARE_OFF_ALL') {
        if (!window.confirm(`FORCE LIQUIDATION: Are you sure you want to market square-off ALL open positions and cancel all orders for ${selectedClient.username}?`)) {
          setActionLoadingId(null);
          return;
        }
        res = await fetch(`/api/v1/admin/risk/clients/${clientId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ cancelOrders: true, squareOffPositions: true }),
        });
      } else if (actionType === 'SYNC_MARGIN') {
        res = await fetch(`/api/v1/admin/risk/clients/${clientId}/sync-margin`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else if (actionType === 'FREEZE') {
        const reason = window.prompt(`Enter reason to suspend account for ${selectedClient.username}:`, 'Risk threshold breach / Margin call');
        if (!reason) {
          setActionLoadingId(null);
          return;
        }
        res = await fetch(`/api/v1/admin/customers/${clientId}/freeze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reason }),
        });
      }

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: data.message || `Action executed successfully for ${selectedClient.username}`,
        });
        setSelectedClient(null);
        await fetchRiskData();
      } else {
        setFeedback({
          type: 'error',
          message: data.error?.message || 'Action failed to execute',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error executing action' });
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    fetchRiskData();
    const interval = setInterval(fetchRiskData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (!risk) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[var(--text-muted)] gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--loss)]" />
        <span className="text-xs font-semibold tracking-wider uppercase">Initializing Risk Command Center...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[var(--loss-light)]/40 via-[var(--bg-surface)]/80 to-[var(--bg-surface)]/90 border border-[var(--loss)]/40 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--loss)]/10 border border-[var(--loss)]/20 text-[var(--loss)]">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[var(--text-main)] tracking-tight flex items-center gap-2">
              RISK COMMAND CENTER
              <span className="text-[10px] font-bold text-[var(--loss)] bg-[var(--loss)]/10 px-2 py-0.5 rounded-full border border-[var(--loss)]/20 uppercase tracking-widest">
                Active Monitoring
              </span>
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Real-Time Pre-Trade RMS & Margin Utilization Safeguards</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRiskData}
            disabled={loading}
            className="p-2 rounded-lg bg-[var(--bg-surface-elevated)]/80 hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]/60 transition-all duration-200"
            title="Refresh Risk Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[var(--loss)]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border backdrop-blur-md transition-all shadow-md ${
            feedback.type === 'success'
              ? 'bg-[var(--gain-light)]/40 border-[var(--gain)]/60 text-[var(--gain)]'
              : feedback.type === 'error'
              ? 'bg-[var(--loss-light)]/40 border-[var(--loss)]/60 text-[var(--loss)]'
              : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-main)]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded-md transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-4 transition-all duration-300 shadow-xl hover:-translate-y-0.5">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Total Risk Exposure</span>
          <span className="text-2xl font-extrabold text-[var(--warning)] font-mono tracking-tight block mt-1">₹{risk.totalExposure.toLocaleString('en-IN')}</span>
          <span className="text-[9px] font-semibold text-[var(--text-tertiary)] mt-1 block">Active Position Capital</span>
        </div>
        <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-4 transition-all duration-300 shadow-xl hover:-translate-y-0.5">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Margin Utilized Pool</span>
          <span className="text-2xl font-extrabold text-[var(--gogrow-blue)] font-mono tracking-tight block mt-1">₹{risk.marginUsed.toLocaleString('en-IN')}</span>
          <span className="text-[9px] font-semibold text-[var(--text-tertiary)] mt-1 block">Blocked Pre-Trade Capital</span>
        </div>
        <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-4 transition-all duration-300 shadow-xl hover:-translate-y-0.5">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Frozen / Restricted Accounts</span>
          <span className="text-2xl font-extrabold text-[var(--loss)] tracking-tight block mt-1">{risk.frozenAccounts?.length || 0}</span>
          <span className="text-[9px] font-semibold text-[var(--text-tertiary)] mt-1 block">Suspended Access</span>
        </div>
      </div>

      {/* High Risk Clients */}
      <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
            <Flame className="w-4 h-4 text-[var(--loss)]" /> High-Risk Clients (Margin Utilization {'>'} 80%)
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncAllMargins}
              disabled={syncingAll || loading}
              className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-[var(--primary)]/15 hover:bg-[var(--primary)]/25 text-[var(--primary)] border border-[var(--primary)]/30 transition cursor-pointer disabled:opacity-50"
              title="Recalculate and heal margins across all high-risk accounts"
            >
              <RefreshCw className={`w-3 h-3 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll ? 'Syncing Margins...' : 'Heal / Sync All Margins'}
            </button>
            <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface-elevated)] px-2 py-1 rounded-md border border-[var(--border-color)]">
              Clients: {(risk.highRiskClients || []).length}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-color)]/80 p-3">
          <DataTable
            columns={[
              {
                key: 'client',
                header: 'Client',
                mobilePrimary: true,
                render: (c: any) => (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--loss)] animate-pulse flex-shrink-0" />
                    <CustomerHoverCard userId={c.id || c.user_id} token={token} onOpenCustomer360={onOpenCustomer360}>
                      <span className="font-bold text-[var(--text-main)] hover:underline cursor-pointer">{c.username}</span>
                    </CustomerHoverCard>
                  </div>
                ),
              },
              {
                key: 'email',
                header: 'Email',
                mobileHidden: true,
                render: (c: any) => <span className="text-[var(--text-muted)] font-mono text-[11px]">{c.email}</span>,
              },
              {
                key: 'cash',
                header: 'Cash Balance',
                align: 'right',
                render: (c: any) => (
                  <span className="font-mono font-bold text-[var(--gain)]">
                    ₹{parseFloat(c.cash_balance).toLocaleString('en-IN')}
                  </span>
                ),
              },
              {
                key: 'margin',
                header: 'Used Margin',
                align: 'right',
                render: (c: any) => (
                  <span className="font-mono font-bold text-[var(--warning)]">
                    ₹{parseFloat(c.used_margin).toLocaleString('en-IN')}
                  </span>
                ),
              },
              {
                key: 'utilization',
                header: 'Utilization Bar',
                align: 'right',
                render: (c: any) => {
                  const utilVal = c.cash_balance > 0 ? (c.used_margin / c.cash_balance) * 100 : 0;
                  const utilText = c.cash_balance > 0 ? `${utilVal.toFixed(1)}%` : '100%';
                  const utilPct = Math.min(100, Math.max(0, utilVal));
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 bg-[var(--bg-body)] rounded-full h-2 overflow-hidden border border-[var(--border-color)]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            utilPct > 90
                              ? 'bg-[var(--loss)] shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                              : utilPct > 75
                              ? 'bg-[var(--warning)] shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                              : 'bg-[var(--primary)]'
                          }`}
                          style={{ width: `${utilPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-[var(--loss)] font-mono w-14 text-right">
                        {utilText}
                      </span>
                    </div>
                  );
                },
              },
              {
                key: 'actions',
                header: 'Risk Resolution Actions',
                align: 'right',
                render: (c: any) => {
                  const clientId = c.id || c.user_id;
                  const isActing = actionLoadingId === clientId;
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleQuickResolve(c)}
                        disabled={isActing}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-[var(--loss)]/15 hover:bg-[var(--loss)]/25 text-[var(--loss)] border border-[var(--loss)]/30 transition cursor-pointer disabled:opacity-50"
                        title="Quick Resolve: Cancel resting orders & synchronize margin"
                      >
                        <Zap className={`w-3.5 h-3.5 ${isActing ? 'animate-spin' : ''}`} />
                        {isActing ? 'Resolving...' : 'Resolve Risk'}
                      </button>
                      <button
                        onClick={() => setSelectedClient(c)}
                        className="p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)] transition cursor-pointer"
                        title="Open full risk resolution control center"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                },
              },
            ]}
            rows={risk.highRiskClients || []}
            rowKey={(c: any) => c.id}
            emptyIcon={<ShieldCheck className="w-6 h-6" />}
            emptyTitle="No high-risk clients"
            emptyMessage="No over-leveraged high-risk accounts detected. All clients operate within safety margin parameters."
          />
        </div>
      </div>

      {/* Margin Alerts */}
      <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--warning)]" /> Active Risk Alerts & Notifications
          </h3>
          <button
            onClick={() =>
              exportToCsv('risk-alerts', [...(risk.marginAlerts || []), ...(risk.rmsBlocks || [])], [
                { header: 'Event Type', value: (a: any) => a.event_type },
                { header: 'Severity', value: (a: any) => a.severity },
                { header: 'Customer ID', value: (a: any) => a.customer_id },
                { header: 'Details', value: (a: any) => JSON.stringify(a.details) },
                { header: 'Created At', value: (a: any) => new Date(a.created_at).toLocaleString() },
              ])
            }
            disabled={(risk.marginAlerts || []).length === 0 && (risk.rmsBlocks || []).length === 0}
            className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-40 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <div className="space-y-2.5">
          {(risk.marginAlerts || []).map((a: any) => (
            <div
              key={a.id}
              className={`flex items-center gap-3 p-3.5 rounded-xl border backdrop-blur-md transition-all ${
                a.severity === 'CRITICAL'
                  ? 'bg-[var(--loss-light)]/40 border-[var(--loss)]/80 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                  : a.severity === 'HIGH'
                  ? 'bg-[var(--warning-light)]/40 border-[var(--warning)]/80'
                  : 'bg-[var(--bg-surface)]/80 border-[var(--border-color)]'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  a.severity === 'CRITICAL'
                    ? 'bg-[var(--loss)] shadow-[0_0_10px_rgba(248,113,113,0.8)] animate-pulse'
                    : a.severity === 'HIGH'
                    ? 'bg-[var(--warning)] shadow-[0_0_10px_rgba(251,191,36,0.8)]'
                    : 'bg-[var(--bg-surface-elevated)]'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-main)]">{a.event_type}</span>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                      a.severity === 'CRITICAL'
                        ? 'bg-[var(--loss)]/20 text-[var(--loss)]'
                        : a.severity === 'HIGH'
                        ? 'bg-[var(--warning)]/20 text-[var(--warning)]'
                        : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'
                    }`}
                  >
                    {a.severity}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] block mt-0.5 truncate">
                  {a.details?.message || JSON.stringify(a.details)}
                </span>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-tertiary)] whitespace-nowrap">
                {new Date(a.created_at).toLocaleString('en-IN')}
              </span>
              <button
                onClick={() => handleResolveAlert(a.id)}
                disabled={resolvingId === a.id}
                className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-on-accent)] disabled:opacity-50 transition cursor-pointer"
                title="Mark this risk event as resolved"
              >
                <CheckCircle2 className="w-3 h-3" /> {resolvingId === a.id ? '...' : 'Resolve'}
              </button>
            </div>
          ))}
          {(!risk.marginAlerts || risk.marginAlerts.length === 0) && (
            <div className="text-center py-6 text-[var(--text-tertiary)] text-xs bg-[var(--bg-surface)]/40 rounded-xl border border-[var(--border-color)]/60">
              No active risk alerts recorded.
            </div>
          )}
        </div>
      </div>

      {/* RMS Blocks */}
      <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-5 shadow-xl pb-6">
        <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--loss)]" /> Pre-Trade RMS Rejections & Blocks
        </h3>
        <div className="space-y-2.5">
          {(risk.rmsBlocks || []).map((b: any) => (
            <div key={b.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--loss-light)]/30 border border-[var(--loss)]/60">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--loss)] flex-shrink-0 animate-pulse" />
              <div className="flex-1">
                <span className="text-xs font-bold text-[var(--text-main)]">{b.event_type}</span>
                <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">{JSON.stringify(b.details)}</span>
              </div>
              <button
                onClick={() => handleResolveAlert(b.id)}
                disabled={resolvingId === b.id}
                className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-on-accent)] disabled:opacity-50 transition cursor-pointer"
                title="Mark this risk event as resolved"
              >
                <CheckCircle2 className="w-3 h-3" /> {resolvingId === b.id ? '...' : 'Resolve'}
              </button>
            </div>
          ))}
          {(!risk.rmsBlocks || risk.rmsBlocks.length === 0) && (
            <div className="text-center py-6 text-[var(--text-tertiary)] text-xs bg-[var(--bg-surface)]/40 rounded-xl border border-[var(--border-color)]/60">
              No RMS pre-trade order rejections recorded.
            </div>
          )}
        </div>
      </div>

      {/* Client Risk Action Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)]/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[var(--loss)]/15 text-[var(--loss)] border border-[var(--loss)]/30">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-2">
                    Resolve Risk: {selectedClient.username}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono">{selectedClient.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Account Metrics Grid */}
            <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-body)]/40 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">CASH BALANCE</span>
                <span className="text-sm font-bold font-mono text-[var(--gain)] mt-0.5 block">
                  ₹{parseFloat(selectedClient.cash_balance).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">USED MARGIN</span>
                <span className="text-sm font-bold font-mono text-[var(--loss)] mt-0.5 block">
                  ₹{parseFloat(selectedClient.used_margin).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Action Buttons List */}
            <div className="p-5 space-y-3 max-h-[380px] overflow-y-auto">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Available Resolution Options
              </div>

              {/* Option 1: Quick Resolve */}
              <button
                onClick={() => handleExecuteAction('RESOLVE')}
                disabled={actionLoadingId === (selectedClient.id || selectedClient.user_id)}
                className="w-full text-left p-3.5 rounded-xl border border-[var(--loss)]/40 bg-[var(--loss-light)]/20 hover:bg-[var(--loss-light)]/40 transition flex items-start gap-3 group cursor-pointer disabled:opacity-50"
              >
                <div className="p-2 rounded-lg bg-[var(--loss)]/20 text-[var(--loss)] shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-[var(--text-main)] flex items-center justify-between">
                    <span>⚡ Quick Resolve Risk (Recommended)</span>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[var(--loss)]/20 text-[var(--loss)]">Auto-Heal</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Cancels all orphaned / resting orders and recalculates margin from live positions. Resolves stuck margin instantly.
                  </p>
                </div>
              </button>

              {/* Option 2: Sync Margin */}
              <button
                onClick={() => handleExecuteAction('SYNC_MARGIN')}
                disabled={actionLoadingId === (selectedClient.id || selectedClient.user_id)}
                className="w-full text-left p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] transition flex items-start gap-3 cursor-pointer disabled:opacity-50"
              >
                <div className="p-2 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] shrink-0 mt-0.5">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-[var(--text-main)] block">🔄 Synchronize Authoritative Margin</span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Recomputes margin from actual database positions and active orders without cancelling anything.
                  </p>
                </div>
              </button>

              {/* Option 3: Cancel Orders */}
              <button
                onClick={() => handleExecuteAction('CANCEL_ORDERS')}
                disabled={actionLoadingId === (selectedClient.id || selectedClient.user_id)}
                className="w-full text-left p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] transition flex items-start gap-3 cursor-pointer disabled:opacity-50"
              >
                <div className="p-2 rounded-lg bg-[var(--warning)]/15 text-[var(--warning)] shrink-0 mt-0.5">
                  <Ban className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-[var(--text-main)] block">❌ Cancel All Pending Orders</span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Cancels all resting limit and trigger orders reserving margin across all exchanges.
                  </p>
                </div>
              </button>

              {/* Option 4: Square-Off All */}
              <button
                onClick={() => handleExecuteAction('SQUARE_OFF_ALL')}
                disabled={actionLoadingId === (selectedClient.id || selectedClient.user_id)}
                className="w-full text-left p-3.5 rounded-xl border border-[var(--loss)]/30 bg-[var(--bg-surface)] hover:bg-[var(--loss-light)]/20 transition flex items-start gap-3 cursor-pointer disabled:opacity-50"
              >
                <div className="p-2 rounded-lg bg-[var(--loss)]/15 text-[var(--loss)] shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-[var(--loss)] block">⚠️ Emergency Force Square-Off All Positions</span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Market exit all open positions and cancel orders immediately (Margin Call Liquidation).
                  </p>
                </div>
              </button>

              {/* Option 5: Freeze Account */}
              <button
                onClick={() => handleExecuteAction('FREEZE')}
                disabled={actionLoadingId === (selectedClient.id || selectedClient.user_id)}
                className="w-full text-left p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] transition flex items-start gap-3 cursor-pointer disabled:opacity-50"
              >
                <div className="p-2 rounded-lg bg-[var(--text-muted)]/15 text-[var(--text-muted)] shrink-0 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-[var(--text-main)] block">🛡️ Freeze Client Trading Account</span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Temporarily suspend login and order placement rights for risk containment.
                  </p>
                </div>
              </button>

              {/* Option 6: Open Customer 360 */}
              {onOpenCustomer360 && (
                <button
                  onClick={() => {
                    const cid = selectedClient.id || selectedClient.user_id;
                    setSelectedClient(null);
                    onOpenCustomer360(cid);
                  }}
                  className="w-full text-left p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] transition flex items-start gap-3 cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-[var(--gogrow-blue)]/15 text-[var(--gogrow-blue)] shrink-0 mt-0.5">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[var(--text-main)] block">👤 Open Full Profile in Customer 360</span>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      Inspect individual orders, trade logs, live positions, KYC, and wallet ledger.
                    </p>
                  </div>
                </button>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface-elevated)]/30 flex justify-end">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

