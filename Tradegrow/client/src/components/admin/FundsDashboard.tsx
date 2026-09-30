import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, XCircle, Clock, ArrowDownLeft, ArrowUpRight, Lock, ShieldCheck, QrCode, Building, CreditCard, Save, RefreshCw, X, Sliders, AlertCircle, AlertTriangle, Inbox, BookOpen } from 'lucide-react';
import { DataTable, DataTableColumn } from '../ui/DataTable';
import { useMarketSocket, useAdminSubscribeAll } from '../../hooks/useMarketSocket';

interface FundsDashboardProps { token: string; }

export const FundsDashboard: React.FC<FundsDashboardProps> = ({ token }) => {
  const [funds, setFunds] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [clients, setClients] = useState<any[]>([]);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustAmount, setAdjustAmount] = useState<number>(50000);
  const [adjustReason, setAdjustReason] = useState<string>('Admin Balance Adjustment');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Partial Approval Modal State
  const [partialModalReq, setPartialModalReq] = useState<any | null>(null);
  const [partialAmountInput, setPartialAmountInput] = useState<number>(0);
  const [partialAdminNote, setPartialAdminNote] = useState<string>('');
  const [submittingPartial, setSubmittingPartial] = useState(false);

  // Rejection Modal State
  const [rejectModalReq, setRejectModalReq] = useState<any | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('Bank details mismatch / Verification required');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Admin Payment Settings State (Merchant UPI & Bank Receiving Account)
  const [paymentSettings, setPaymentSettings] = useState<{
    upiId: string;
    merchantName: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
  }>({
    upiId: 'expertstokks@axl',
    merchantName: 'Trade Grow Brokerage',
    bankName: 'HDFC Bank',
    accountName: 'Trade Grow Technologies Pvt Ltd',
    accountNumber: '50200098765432',
    ifscCode: 'HDFC0001234',
    branch: 'Mumbai Main Branch'
  });
  const [submittingPaymentSettings, setSubmittingPaymentSettings] = useState(false);
  const [paymentSettingMsg, setPaymentSettingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Platform Solvency & Real Bank Reserves State
  const [solvency, setSolvency] = useState<any | null>(null);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [bankCashInput, setBankCashInput] = useState<number>(1000000);
  const [reconcileNotes, setReconcileNotes] = useState<string>('Daily Platform Liquidity & Bank Reserve Audit');
  const [submittingReconcile, setSubmittingReconcile] = useState(false);

  const { onAdminEvent } = useMarketSocket();
  useAdminSubscribeAll();

  const fetchFundsData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/v1/admin/funds/overview', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/funds/requests', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/customers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/funds/payment-settings', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/finance/reserves', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ]).then(([overviewData, requestsData, customersData, settingsData, solvencyData]) => {
      if (overviewData.success) setFunds(overviewData.funds);
      if (requestsData.success && Array.isArray(requestsData.requests)) setRequests(requestsData.requests);
      if (customersData.success && Array.isArray(customersData.customers)) {
        setClients(customersData.customers);
        if (customersData.customers.length > 0 && !targetUserId) {
          setTargetUserId(customersData.customers[0].id);
        }
      }
      if (settingsData.success && settingsData.settings) {
        setPaymentSettings(settingsData.settings);
      }
      if (solvencyData.success && solvencyData.solvency) {
        setSolvency(solvencyData.solvency);
        setBankCashInput(solvencyData.solvency.bankCashReserve || 1000000);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReconcile(true);
    setActionMsg(null);

    try {
      const res = await fetch('/api/v1/admin/finance/reserves/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bankCashReserve: bankCashInput, notes: reconcileNotes })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        setShowReconcileModal(false);
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to reconcile reserves' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingReconcile(false);
    }
  };

  useEffect(() => {
    fetchFundsData();
  }, [token]);

  // Live push: a new deposit/withdrawal request, or one being approved/rejected
  // (by this admin or another one), refreshes the queue immediately — this page
  // has no polling fallback today, so without this a new request only appears
  // on the next manual action or full page reload.
  useEffect(() => {
    const unsub1 = onAdminEvent(() => fetchFundsData(), 'FUND_REQUEST_CREATED');
    const unsub2 = onAdminEvent(() => fetchFundsData(), 'FUND_REQUEST_UPDATED');
    return () => { unsub1(); unsub2(); };
  }, [onAdminEvent]);

  const handleDirectAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || !adjustAmount || adjustAmount <= 0) return;
    setSubmittingAdjust(true);
    setActionMsg(null);

    try {
      const res = await fetch('/api/v1/admin/funds/direct-adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: targetUserId,
          requestType: adjustType,
          amount: adjustAmount,
          reason: adjustReason
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        setAdjustReason('Admin Balance Adjustment');
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to adjust balance' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleApprove = async (id: string, requestId: string) => {
    if (!window.confirm(`Are you sure you want to approve the FULL amount for request ${requestId}?`)) return;
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/funds/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: `Approved request ${requestId}. Client wallet updated.` });
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to approve request.' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const openPartialModal = (r: any) => {
    setPartialModalReq(r);
    const origAmt = parseFloat(r.amount) || 0;
    setPartialAmountInput(Math.round(origAmt * 0.5)); // Default 50%
    setPartialAdminNote(`Partial payment processed via ${r.payment_method || 'Bank'}`);
  };

  const handlePartialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialModalReq || !partialAmountInput || partialAmountInput <= 0) return;
    const origAmt = parseFloat(partialModalReq.amount) || 0;
    if (partialAmountInput >= origAmt) {
      alert('Partial amount must be less than the full requested amount. Use "Approve Full" instead.');
      return;
    }

    setSubmittingPartial(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/funds/requests/${partialModalReq.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          approvedAmount: partialAmountInput,
          adminNote: partialAdminNote
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message || `Partially approved ₹${partialAmountInput.toLocaleString('en-IN')} for ${partialModalReq.request_id}.` });
        setPartialModalReq(null);
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to partially approve request.' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingPartial(false);
    }
  };

  const openRejectModal = (r: any) => {
    setRejectModalReq(r);
    setRejectReasonInput('Bank details mismatch / Verification required');
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalReq) return;

    setSubmittingReject(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/funds/requests/${rejectModalReq.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectReasonInput })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: `Rejected request ${rejectModalReq.request_id}.` });
        setRejectModalReq(null);
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to reject request.' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingReject(false);
    }
  };

  if (loading && !funds) return <div className="text-[var(--text-muted)] text-sm p-8">Loading funds overview & requests...</div>;

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1">
      {/* Overview Stat Cards */}
      {funds && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Funds', value: `₹${funds.totalFunds.toLocaleString('en-IN')}`, color: 'text-[var(--primary)]' },
            { label: 'Available Cash', value: `₹${funds.available.toLocaleString('en-IN')}`, color: 'text-[var(--primary)]' },
            { label: 'Blocked (Margin)', value: `₹${funds.blocked.toLocaleString('en-IN')}`, color: 'text-[var(--warning)]' },
            { label: 'Pending Requests', value: requests.filter(r => r.status === 'PENDING').length, color: 'text-[var(--warning)]' },
            { label: 'Pending Amount', value: `₹${requests.filter(r => r.status === 'PENDING').reduce((acc, r) => acc + parseFloat(r.amount), 0).toLocaleString('en-IN')}`, color: 'text-[var(--warning)]' },
          ].map(k => (
            <div key={k.label} className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)] rounded-xl p-4">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block">{k.label}</span>
              <span className={`text-xl font-bold ${k.color} font-mono block mt-1`}>{k.value}</span>
            </div>
          ))}
        </div>
      )}

      {actionMsg && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-md transition-all ${actionMsg.type === 'success' ? 'bg-[var(--primary-light)]/90 text-[var(--primary)] border border-[var(--primary)]' : 'bg-[var(--loss-light)]/90 text-[var(--loss)] border border-[var(--loss)]'}`}>
          <div className="flex items-center gap-2">
            {actionMsg.type === 'error' ? <XCircle className="w-4 h-4 text-[var(--loss)] shrink-0" /> : <CheckCircle className="w-4 h-4 text-[var(--primary)] shrink-0" />}
            <span>{actionMsg.text.replace(/^[A-Z_]+:/, '')}</span>
          </div>
          <button 
            onClick={() => setActionMsg(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer ml-3 shrink-0"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Platform Real-Money Solvency & Bank Reserves Monitor */}
      {solvency && (
        <div className="bg-gradient-to-r from-[var(--bg-surface)]/90 via-[var(--bg-surface)]/70 to-[var(--bg-surface)]/90 border border-[var(--border-color)] rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              solvency.status === 'HEALTHY' ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20' :
              solvency.status === 'WARNING' ? 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20' :
              'bg-[var(--loss)]/10 text-[var(--loss)] border-[var(--loss)]/20'
            }`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[var(--text-main)]">Platform Solvency & Real Bank Reserves</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  solvency.status === 'HEALTHY' ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]' :
                  solvency.status === 'WARNING' ? 'bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]' :
                  'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]'
                }`}>
                  {solvency.status} SOLVENCY ({(solvency.reserveRatio * 100).toFixed(0)}%)
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                Total Real-Money Liabilities: <span className="text-[var(--warning)] font-mono font-bold">₹{solvency.totalWithdrawableLiabilities.toLocaleString('en-IN')}</span> · 
                Bank Cash Reserves: <span className="text-[var(--primary)] font-mono font-bold">₹{solvency.bankCashReserve.toLocaleString('en-IN')}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowReconcileModal(true)}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border-color)] hover:border-[var(--border-color)] font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer ml-auto"
          >
            <Building className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Reconcile Bank Reserve</span>
          </button>
        </div>
      )}

      {/* DIRECT ADMIN FUND ADJUSTMENT CARD */}
      <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[var(--primary)]" /> Direct Admin Fund Addition / Withdrawal (Instant Credit or Debit)
        </h3>

        <form onSubmit={handleDirectAdjust} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end text-xs">
          <div>
            <label className="text-[10px] text-[var(--text-muted)] font-bold block mb-1 uppercase">Select Client</label>
            <select
              value={targetUserId}
              onChange={e => setTargetUserId(e.target.value)}
              aria-label="Select client"
              className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)] font-semibold"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.username} ({c.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] font-bold block mb-1 uppercase">Action Type</label>
            <select
              value={adjustType}
              onChange={e => setAdjustType(e.target.value as any)}
              aria-label="Action type"
              className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)] font-semibold"
            >
              <option value="CREDIT">+ CREDIT (Add Funds)</option>
              <option value="DEBIT">- DEBIT (Withdraw Funds)</option>
            </select>
          </div>

          <div>
            <label htmlFor="fund-adjust-amount" className="text-[10px] text-[var(--text-muted)] font-bold block mb-1 uppercase">Amount (₹)</label>
            <input
              id="fund-adjust-amount"
              type="number"
              min="1"
              step="100"
              value={adjustAmount}
              onChange={e => setAdjustAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)] font-mono font-bold"
            />
          </div>

          <div>
            <label htmlFor="fund-adjust-reason" className="text-[10px] text-[var(--text-muted)] font-bold block mb-1 uppercase">Reason / Audit Note</label>
            <input
              id="fund-adjust-reason"
              type="text"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              placeholder="Reason for adjustment"
              className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)]"
            />
          </div>

          <button
            type="submit"
            disabled={submittingAdjust}
            className={`py-2 px-4 rounded-lg font-bold text-xs text-[var(--text-on-accent)] transition flex items-center justify-center gap-1 shadow ${
              adjustType === 'CREDIT' ? 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]' : 'bg-[var(--loss)] hover:bg-[var(--loss)]'
            }`}
          >
            {submittingAdjust ? 'Executing...' : `${adjustType === 'CREDIT' ? 'Add Funds' : 'Debit Funds'}`}
          </button>
        </form>
      </div>

      {/* PENDING APPROVAL REQUESTS SECTION */}
      <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)] rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--warning)]" /> Pending Client Fund Approval Requests ({requests.filter(r => r.status === 'PENDING').length})
          </h3>
          <span className="text-[10px] bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)] px-2 py-0.5 rounded font-mono">
            Requires Admin Action
          </span>
        </div>

        <DataTable
          columns={[
            {
              key: 'reqClient', header: 'Req ID & Client', mobilePrimary: true,
              render: (r: any) => (
                <div>
                  <div className="font-mono font-bold text-[var(--warning)] text-[11px]">{r.request_id}</div>
                  <div className="font-bold text-[var(--text-main)] text-[11px] truncate max-w-[140px]">{r.username}</div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono truncate max-w-[140px]">{r.email}</div>
                </div>
              ),
            },
            {
              key: 'type', header: 'Type',
              render: (r: any) => (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${r.request_type === 'DEPOSIT' ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/80' : 'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]/80'}`}>
                  {r.request_type === 'DEPOSIT' ? <ArrowDownLeft className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
                  {r.request_type}
                </span>
              ),
            },
            { key: 'amount', header: 'Amount', align: 'right', render: (r: any) => <span className="font-mono font-bold text-[var(--text-main)]">₹{parseFloat(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> },
            {
              key: 'method', header: 'Method & Note',
              render: (r: any) => (
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono font-semibold">{r.payment_method || 'UPI'}</div>
                  <div className="text-[9px] text-[var(--text-muted)] truncate max-w-[150px]" title={r.reference_note || ''}>{r.reference_note || '-'}</div>
                </div>
              ),
            },
            {
              key: 'requested', header: 'Requested', mobileHidden: true,
              render: (r: any) => <span className="text-[10px] text-[var(--text-muted)] font-mono whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('en-IN', { month: 'numeric', day: 'numeric' })}, {new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>,
            },
            {
              key: 'status', header: 'Status', align: 'center',
              render: (r: any) => (
                <div className="flex flex-col items-center gap-1">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider inline-block ${
                    r.status === 'APPROVED' ? 'bg-[var(--primary-light)]/90 text-[var(--primary)] border border-[var(--primary)]' :
                    r.status === 'PARTIALLY_APPROVED' ? 'bg-[var(--gogrow-blue-light)]/90 text-[var(--gogrow-blue)] border border-[var(--gogrow-blue)]' :
                    r.status === 'REJECTED' ? 'bg-[var(--loss-light)]/90 text-[var(--loss)] border border-[var(--loss)]' :
                    'bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]'
                  }`}>
                    {r.status === 'PENDING' ? 'PENDING' : r.status === 'PARTIALLY_APPROVED' ? 'PARTIAL' : r.status}
                  </span>
                  {r.review_tier === 'TIER_2_SENIOR' && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider inline-flex items-center gap-0.5 bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]" title="Escalated: exceeds the first approver's authority limit — needs a senior approver">
                      <AlertTriangle className="w-2.5 h-2.5" /> Tier-2
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'action', header: 'Action', align: 'center',
              render: (r: any) => r.status === 'PENDING' ? (
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => handleApprove(r.id, r.request_id)} className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-95 text-[var(--text-on-accent)] text-[10px] font-bold px-2 py-1 rounded transition shadow flex items-center gap-0.5 shrink-0 cursor-pointer" title="Approve full amount">
                    <CheckCircle className="w-3 h-3" /> Approve
                  </button>
                  {r.request_type === 'WITHDRAWAL' && (
                    <button onClick={() => openPartialModal(r)} className="bg-[var(--gogrow-blue)] hover:bg-[var(--gogrow-blue)] active:scale-95 text-[var(--text-on-accent)] text-[10px] font-bold px-2 py-1 rounded transition shadow flex items-center gap-0.5 shrink-0 cursor-pointer" title="Approve partial amount">
                      <Sliders className="w-3 h-3" /> Partial
                    </button>
                  )}
                  <button onClick={() => openRejectModal(r)} className="bg-[var(--loss)] hover:bg-[var(--loss)] active:scale-95 text-[var(--text-on-accent)] text-[10px] font-bold px-2 py-1 rounded transition shadow flex items-center gap-0.5 shrink-0 cursor-pointer" title="Reject request">
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </div>
              ) : (
                <span className="text-[10px] font-mono text-[var(--text-tertiary)]">Processed</span>
              ),
            },
          ]}
          rows={requests}
          rowKey={(r: any) => r.id}
          isLoading={loading}
          emptyIcon={<Inbox className="w-6 h-6" />}
          emptyTitle="No fund requests"
          emptyMessage="No deposit or withdrawal requests found."
        />
      </div>

      {/* Admin Payment Receiving Credentials Management (Merchant UPI & Bank Account) */}
      <div className="bg-gradient-to-r from-[var(--bg-surface)]/90 via-[var(--bg-surface)]/70 to-[var(--bg-surface)]/90 border border-[var(--border-color)] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text-main)] tracking-tight flex items-center gap-2">
                MERCHANT PAYMENT RECEIVING CREDENTIALS
                <span className="text-[9px] font-bold text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded-full border border-[var(--warning)]/20 uppercase tracking-widest flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Admin Access Only
                </span>
              </h3>
              <span className="text-[10px] text-[var(--text-muted)]">Configure Merchant UPI ID & Bank Deposit Account for Client Fund Receipts</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[var(--primary)] bg-[var(--bg-body)] px-3 py-1 rounded-lg border border-[var(--border-color)]">
            Active UPI VPA: {paymentSettings.upiId}
          </span>
        </div>

        <form onSubmit={async (e) => {
          e.preventDefault();
          setSubmittingPaymentSettings(true);
          setPaymentSettingMsg(null);
          try {
            const res = await fetch('/api/v1/admin/funds/payment-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(paymentSettings)
            });
            const data = await res.json();
            if (data.success) {
              setPaymentSettingMsg({ type: 'success', text: data.message });
            } else {
              setPaymentSettingMsg({ type: 'error', text: data.error?.message || 'Failed to update settings' });
            }
          } catch (err: any) {
            setPaymentSettingMsg({ type: 'error', text: err.message });
          } finally {
            setSubmittingPaymentSettings(false);
          }
        }} className="space-y-4">
          
          {/* UPI Settings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--bg-body)]/60 p-4 rounded-xl border border-[var(--border-color)]">
            <div>
              <label htmlFor="payment-upi-id" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Merchant UPI VPA / ID
              </label>
              <input
                id="payment-upi-id"
                type="text"
                value={paymentSettings.upiId}
                onChange={e => setPaymentSettings({ ...paymentSettings, upiId: e.target.value })}
                placeholder="e.g. expertstokks@axl or 9876543210@paytm"
                required
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[var(--primary)] focus:outline-none focus:border-[var(--primary)]"
              />
              <span className="text-[9px] text-[var(--text-tertiary)] mt-1 block">Receives client instant UPI payments & displayed on Deposit QR page</span>
            </div>

            <div>
              <label htmlFor="payment-merchant-name" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Merchant Business Name
              </label>
              <input
                id="payment-merchant-name"
                type="text"
                value={paymentSettings.merchantName}
                onChange={e => setPaymentSettings({ ...paymentSettings, merchantName: e.target.value })}
                placeholder="e.g. Trade Grow Brokerage"
                required
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
              />
              <span className="text-[9px] text-[var(--text-tertiary)] mt-1 block">Displayed on customer deposit page & UPI payment prompt</span>
            </div>
          </div>

          {/* Bank Wire Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[var(--bg-body)]/60 p-4 rounded-xl border border-[var(--border-color)]">
            <div>
              <label htmlFor="payment-bank-name" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Bank Name</label>
              <input
                id="payment-bank-name"
                type="text"
                value={paymentSettings.bankName}
                onChange={e => setPaymentSettings({ ...paymentSettings, bankName: e.target.value })}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label htmlFor="payment-account-name" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Account Holder Name</label>
              <input
                id="payment-account-name"
                type="text"
                value={paymentSettings.accountName}
                onChange={e => setPaymentSettings({ ...paymentSettings, accountName: e.target.value })}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label htmlFor="payment-account-number" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Account Number</label>
              <input
                id="payment-account-number"
                type="text"
                value={paymentSettings.accountNumber}
                onChange={e => setPaymentSettings({ ...paymentSettings, accountNumber: e.target.value })}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[var(--primary)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label htmlFor="payment-ifsc-code" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">IFSC Code</label>
              <input
                id="payment-ifsc-code"
                type="text"
                value={paymentSettings.ifscCode}
                onChange={e => setPaymentSettings({ ...paymentSettings, ifscCode: e.target.value.toUpperCase() })}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[var(--warning)] focus:outline-none focus:border-[var(--primary)] uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="payment-branch" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Branch Location</label>
              <input
                id="payment-branch"
                type="text"
                value={paymentSettings.branch}
                onChange={e => setPaymentSettings({ ...paymentSettings, branch: e.target.value })}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          {paymentSettingMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold ${
              paymentSettingMsg.type === 'success' ? 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30' : 'bg-[var(--loss)]/10 text-[var(--loss)] border border-[var(--loss)]/30'
            }`}>
              {paymentSettingMsg.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="submit"
              disabled={submittingPaymentSettings}
              className="px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-on-accent)] font-extrabold text-xs flex items-center gap-2 transition shadow-lg disabled:opacity-50"
            >
              {submittingPaymentSettings ? (
                <span>Saving Credentials...</span>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Merchant Receiving Credentials (Admin Lock)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Recent Ledger Transactions */}
      {funds && (
        <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-4">
          <h3 className="text-sm font-bold text-[var(--text-main)] mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[var(--primary)]" /> Wallet Ledger Audit History
          </h3>
          <div className="overflow-y-auto max-h-[300px]">
            <DataTable
              columns={[
                { key: 'txnId', header: 'Txn ID', mobileHidden: true, render: (t: any) => <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{t.transaction_id?.slice(0, 8)}</span> },
                { key: 'client', header: 'Client', mobilePrimary: true, render: (t: any) => <span className="font-semibold text-[var(--text-main)]">{t.username}</span> },
                { key: 'type', header: 'Type', render: (t: any) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.transaction_type === 'CREDIT' ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'bg-[var(--loss-light)] text-[var(--loss)]'}`}>{t.transaction_type}</span> },
                { key: 'amount', header: 'Amount', align: 'right', render: (t: any) => <span className="font-mono font-bold text-[var(--text-main)]">₹{parseFloat(t.amount).toLocaleString('en-IN')}</span> },
                { key: 'after', header: 'Balance After', align: 'right', render: (t: any) => <span className="font-mono text-[var(--primary)]">₹{parseFloat(t.balance_after).toLocaleString('en-IN')}</span> },
                { key: 'time', header: 'Time', render: (t: any) => <span className="text-[10px] text-[var(--text-tertiary)]">{new Date(t.created_at).toLocaleString()}</span> },
              ]}
              rows={funds.recentTransactions || []}
              rowKey={(t: any) => t.id}
              emptyIcon={<BookOpen className="w-6 h-6" />}
              emptyTitle="No ledger transactions"
              emptyMessage="No wallet ledger transactions recorded yet."
            />
          </div>
        </div>
      )}

      {/* PARTIAL WITHDRAWAL APPROVAL MODAL */}
      {partialModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--gogrow-blue)]/10 text-[var(--gogrow-blue)] border border-[var(--gogrow-blue)]/20">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Approve Partial Withdrawal</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Request: <span className="font-mono text-[var(--warning)] font-bold">{partialModalReq.request_id}</span> ({partialModalReq.username})</p>
                </div>
              </div>
              <button onClick={() => setPartialModalReq(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handlePartialSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[var(--bg-body)] p-3.5 rounded-xl border border-[var(--border-color)] font-mono">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">Total Requested:</span>
                  <span className="text-[var(--text-main)] font-bold text-sm">₹{parseFloat(partialModalReq.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">Payment Method:</span>
                  <span className="text-[var(--primary)] font-bold text-sm">{partialModalReq.payment_method || 'UPI'}</span>
                </div>
              </div>

              <div>
                <label htmlFor="partial-approved-amount" className="block text-[var(--text-muted)] font-bold mb-1">Approved Amount (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[var(--text-tertiary)] font-bold text-sm">₹</span>
                  <input
                    id="partial-approved-amount"
                    type="number"
                    min="1"
                    max={parseFloat(partialModalReq.amount) - 1}
                    step="any"
                    required
                    value={partialAmountInput || ''}
                    onChange={e => setPartialAmountInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--gogrow-blue)]/40 focus:border-[var(--gogrow-blue)] rounded-xl py-2.5 pl-8 pr-3 text-[var(--text-main)] font-mono font-bold text-base focus:outline-none"
                    placeholder="Enter partial amount..."
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[var(--text-muted)] mt-1.5 font-mono">
                  <span>Retained in Wallet: <strong className="text-[var(--warning)]">₹{Math.max(0, parseFloat(partialModalReq.amount) - (partialAmountInput || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                  <span>Max: ₹{(parseFloat(partialModalReq.amount) - 1).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label htmlFor="partial-admin-note" className="block text-[var(--text-muted)] font-bold mb-1">Admin Audit Note / UTR Reference</label>
                <input
                  id="partial-admin-note"
                  type="text"
                  value={partialAdminNote}
                  onChange={e => setPartialAdminNote(e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl p-2.5 text-[var(--text-main)] text-xs"
                  placeholder="e.g. Approved tranche 1 payout via IMPS UTR 482910..."
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPartialModalReq(null)}
                  className="w-1/2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold py-2.5 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPartial || !partialAmountInput || partialAmountInput <= 0 || partialAmountInput >= parseFloat(partialModalReq.amount)}
                  className="w-1/2 bg-[var(--gogrow-blue)] hover:bg-[var(--gogrow-blue)] disabled:opacity-50 text-[var(--text-on-accent)] font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingPartial ? 'Processing...' : `Approve ₹${(partialAmountInput || 0).toLocaleString('en-IN')}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT REQUEST MODAL */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--loss)]/10 text-[var(--loss)] border border-[var(--loss)]/20">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Reject Fund Request</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Request: <span className="font-mono text-[var(--warning)] font-bold">{rejectModalReq.request_id}</span> ({rejectModalReq.username})</p>
                </div>
              </div>
              <button onClick={() => setRejectModalReq(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <div className="bg-[var(--bg-body)] p-3 rounded-xl border border-[var(--border-color)] font-mono text-xs flex justify-between">
                <span className="text-[var(--text-muted)]">Requested Amount:</span>
                <span className="text-[var(--loss)] font-bold text-sm">₹{parseFloat(rejectModalReq.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div>
                <label htmlFor="reject-reason" className="block text-[var(--text-muted)] font-bold mb-1">Rejection Reason *</label>
                <textarea
                  id="reject-reason"
                  required
                  rows={3}
                  value={rejectReasonInput}
                  onChange={e => setRejectReasonInput(e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--loss)]/30 focus:border-[var(--loss)] rounded-xl p-2.5 text-[var(--text-main)] text-xs focus:outline-none"
                  placeholder="Enter rejection reason for client..."
                />
              </div>

              {/* Quick Preset Badges */}
              <div className="flex flex-wrap gap-1.5">
                {['Bank details mismatch', 'Account verification required', 'Duplicate request', 'Turnover criteria pending'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setRejectReasonInput(tag)}
                    className="text-[10px] bg-[var(--bg-body)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] px-2 py-1 rounded-lg border border-[var(--border-color)] transition cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalReq(null)}
                  className="w-1/2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold py-2.5 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReject || !rejectReasonInput.trim()}
                  className="w-1/2 bg-[var(--loss)] hover:bg-[var(--loss)] disabled:opacity-50 text-[var(--text-on-accent)] font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECONCILE BANK RESERVES MODAL */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Reconcile Platform Bank Reserves</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Audit actual bank balance against total real-money liabilities</p>
                </div>
              </div>
              <button onClick={() => setShowReconcileModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleReconcileSubmit} className="space-y-3 text-xs">
              <div className="bg-[var(--bg-body)] p-3.5 rounded-xl border border-[var(--border-color)] space-y-1 font-mono text-xs">
                <div className="flex justify-between text-[var(--text-muted)]">
                  <span>Current User Liabilities:</span>
                  <span className="text-[var(--warning)] font-bold">₹{solvency?.totalWithdrawableLiabilities.toLocaleString('en-IN') || '0'}</span>
                </div>
                <div className="flex justify-between text-[var(--text-muted)]">
                  <span>Last Reconciled:</span>
                  <span className="text-[var(--text-muted)]">{solvency?.lastReconciledAt ? new Date(solvency.lastReconciledAt).toLocaleString() : 'Never'}</span>
                </div>
              </div>

              <div>
                <label htmlFor="reconcile-bank-balance" className="block text-[var(--text-muted)] font-semibold mb-1">Actual Bank Account Balance (₹) *</label>
                <input
                  id="reconcile-bank-balance"
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={bankCashInput}
                  onChange={e => setBankCashInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl p-2.5 text-[var(--text-main)] font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label htmlFor="reconcile-notes" className="block text-[var(--text-muted)] font-semibold mb-1">Audit Notes / Bank Statement Reference</label>
                <input
                  id="reconcile-notes"
                  type="text"
                  value={reconcileNotes}
                  onChange={e => setReconcileNotes(e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl p-2.5 text-[var(--text-main)] text-xs"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="w-1/2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold py-2 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReconcile}
                  className="w-1/2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--text-on-accent)] font-bold py-2 rounded-xl transition shadow cursor-pointer"
                >
                  {submittingReconcile ? 'Saving Audit...' : 'Confirm Solvency'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
