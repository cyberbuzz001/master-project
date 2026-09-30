import React, { useState, useEffect } from 'react';
import {
  Mail, Server, CheckCircle2, AlertCircle, Send, Key, ShieldCheck,
  RefreshCw, Settings, Sliders, Eye, EyeOff, Bell, Sparkles, Check, Info, Users, Megaphone
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  enabled: boolean;
  highPriorityOnly: boolean;
  requireRegistrationOtp: boolean;
  notifyOrders: boolean;
  notifyFunds: boolean;
  notifyKyc: boolean;
  notifySecurity: boolean;
  hasPassword?: boolean;
  superAdminAlertEmail?: string;
  superAdminNotificationsEnabled?: boolean;
}

interface EmailLog {
  id: string;
  user_id?: string;
  to_email: string;
  subject: string;
  template_type: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  error_message?: string;
  created_at: string;
}

export const EmailAdmin: React.FC<{ token: string }> = ({ token }) => {
  const toast = useToast();
  const [config, setConfig] = useState<EmailConfig>({
    smtpHost: 'smtp.hostinger.com',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: 'info@tradegrowx.in',
    smtpPass: '',
    emailFrom: '"TradeGrow" <info@tradegrowx.in>',
    enabled: true,
    highPriorityOnly: true,
    requireRegistrationOtp: true,
    notifyOrders: false,
    notifyFunds: true,
    notifyKyc: true,
    notifySecurity: true,
    superAdminAlertEmail: 'cyberbuzz.mail@gmail.com',
    superAdminNotificationsEnabled: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Broadcast & Manual Campaigns State
  const [broadcastAudience, setBroadcastAudience] = useState<'KYC_PENDING' | 'ACTIVE_USERS' | 'ALL'>('KYC_PENDING');
  const [broadcastType, setBroadcastType] = useState<'KYC_REMINDER' | 'OFFER' | 'BONUS' | 'CUSTOM'>('KYC_REMINDER');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastOfferTitle, setBroadcastOfferTitle] = useState('Exclusive Margin Bonus & Zero Brokerage');
  const [broadcastPromoCode, setBroadcastPromoCode] = useState('TRADEGROW100');
  const [broadcastBonusAmount, setBroadcastBonusAmount] = useState('1000');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, [token]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/admin/email/config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err: any) {
      toast.error('Failed to load email configuration', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await fetch('/api/v1/admin/email/logs?limit=30', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.logs) {
        setLogs(data.logs);
      }
    } catch (_) {}
    finally {
      setLoadingLogs(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/v1/admin/email/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Email settings saved successfully');
        if (data.config) setConfig(data.config);
        setVerifyStatus(null);
      } else {
        toast.error('Failed to save settings', data.error?.message);
      }
    } catch (err: any) {
      toast.error('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyConnection = async () => {
    try {
      setVerifying(true);
      setVerifyStatus(null);
      const res = await fetch('/api/v1/admin/email/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      setVerifyStatus(data);
      if (data.success) {
        toast.success('SMTP connected successfully!');
      } else {
        toast.error('SMTP connection failed', data.message);
      }
    } catch (err: any) {
      setVerifyStatus({ success: false, message: err.message });
      toast.error('Verification error', err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailTo || !testEmailTo.includes('@')) {
      toast.error('Invalid recipient', 'Please enter a valid recipient email address');
      return;
    }
    try {
      setSendingTest(true);
      const res = await fetch('/api/v1/admin/email/test-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ toEmail: testEmailTo.trim() })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Test Email Sent', data.message);
        fetchLogs();
      } else {
        toast.error('Test Email Failed', data.message);
      }
    } catch (err: any) {
      toast.error('Dispatch error', err.message);
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(`Are you sure you want to broadcast this email to ${broadcastAudience === 'KYC_PENDING' ? 'all KYC pending clients' : broadcastAudience === 'ACTIVE_USERS' ? 'all active clients' : 'all registered clients'}?`)) {
      return;
    }
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await fetch('/api/v1/admin/email/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          type: broadcastType,
          targetAudience: broadcastAudience,
          customSubject: broadcastSubject,
          customBody: broadcastBody,
          offerTitle: broadcastOfferTitle,
          promoCode: broadcastPromoCode,
          bonusAmount: parseFloat(broadcastBonusAmount) || 1000
        })
      });
      const data = await res.json();
      if (data.success) {
        setBroadcastResult({ success: true, message: data.message, count: data.count });
        toast.success('Broadcast Queued', data.message);
        fetchLogs();
      } else {
        setBroadcastResult({ success: false, message: data.error?.message || data.message || 'Failed to dispatch broadcast' });
        toast.error('Broadcast Failed', data.error?.message || data.message);
      }
    } catch (err: any) {
      setBroadcastResult({ success: false, message: err.message });
      toast.error('Broadcast Error', err.message);
    } finally {
      setBroadcasting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-[var(--text-muted)] text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-[var(--primary)]" />
        Loading Email Configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Banner */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[var(--text-main)]">Hostinger Email & Automated Notifications</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  DNS VERIFIED
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Configure Hostinger SMTP relay for real-time order fill alerts, wallet deposits, and KYC verification emails.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleVerifyConnection}
              disabled={verifying}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-main)] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
              <span>Test SMTP</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Verification Status Banner */}
        {verifyStatus && (
          <div className={`mt-4 p-3 rounded-lg border text-xs flex items-center gap-2 ${
            verifyStatus.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {verifyStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{verifyStatus.message}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: SMTP Settings Form */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2 pb-2 border-b border-[var(--border-color)]">
              <Server className="w-4 h-4 text-blue-400" />
              <span>Hostinger SMTP Server Credentials</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={config.smtpHost}
                  onChange={e => setConfig({ ...config, smtpHost: e.target.value })}
                  placeholder="smtp.hostinger.com"
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                />
                <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5 block">Default: smtp.hostinger.com</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  SMTP Port & SSL
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={config.smtpPort}
                    onChange={e => setConfig({ ...config, smtpPort: parseInt(e.target.value, 10) || 465 })}
                    placeholder="465"
                    className="w-24 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  />
                  <label className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.smtpSecure}
                      onChange={e => setConfig({ ...config, smtpSecure: e.target.checked })}
                      className="accent-[var(--primary)]"
                    />
                    <span className="text-[11px] text-[var(--text-main)]">Use SSL (465)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  Sender Email (Hostinger Account)
                </label>
                <input
                  type="email"
                  value={config.smtpUser}
                  onChange={e => setConfig({ ...config, smtpUser: e.target.value })}
                  placeholder="info@tradegrowx.in"
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  Hostinger Email Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={config.smtpPass}
                    onChange={e => setConfig({ ...config, smtpPass: e.target.value })}
                    placeholder={config.hasPassword ? '••••••••' : 'Enter email password'}
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg pl-3 pr-9 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {config.hasPassword && !config.smtpPass && (
                  <span className="text-[10px] text-emerald-400 mt-0.5 block">✓ Password currently configured</span>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  From Display Name & Address
                </label>
                <input
                  type="text"
                  value={config.emailFrom}
                  onChange={e => setConfig({ ...config, emailFrom: e.target.value })}
                  placeholder='"TradeGrow" <info@tradegrowx.in>'
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          </form>

          {/* Automated Notification Trigger Policies */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2 pb-2 border-b border-[var(--border-color)]">
              <Bell className="w-4 h-4 text-purple-400" />
              <span>Automated Notification Triggers</span>
            </h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] cursor-pointer hover:border-[var(--primary)]/50 transition">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-main)]">Master Email Notification Switch</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Globally enable or disable all outgoing emails to clients.</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={e => setConfig({ ...config, enabled: e.target.checked })}
                  className="w-4 h-4 accent-[var(--primary)]"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 cursor-pointer hover:border-emerald-500/60 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400">High-Priority Only Mode</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 uppercase tracking-wider">Recommended</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Restricts emails strictly to critical events: Registration OTP, Password Reset OTP, Margin Calls, KYC approvals, and Fund credits. Suppresses routine high-frequency order execution spam.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.highPriorityOnly}
                  onChange={e => setConfig({ ...config, highPriorityOnly: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/30 cursor-pointer hover:border-blue-500/60 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-400">Require Email OTP on Account Signup</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-500/20 text-blue-400 uppercase tracking-wider">Security</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Requires new clients to verify their email address via a 6-digit OTP code before their account is activated and granted terminal access.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.requireRegistrationOtp}
                  onChange={e => setConfig({ ...config, requireRegistrationOtp: e.target.checked })}
                  className="w-4 h-4 accent-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] cursor-pointer hover:border-[var(--primary)]/50 transition">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-main)]">Password Reset & Auth OTPs</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Deliver 6-digit verification codes for forgotten passwords and 2FA authentication. (High Priority)</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifySecurity}
                  onChange={e => setConfig({ ...config, notifySecurity: e.target.checked })}
                  className="w-4 h-4 accent-[var(--primary)]"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] cursor-pointer hover:border-[var(--primary)]/50 transition">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-main)]">Funds & Wallet Updates</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Notify user immediately when admin approves a deposit credit or withdrawal payout. (High Priority)</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyFunds}
                  onChange={e => setConfig({ ...config, notifyFunds: e.target.checked })}
                  className="w-4 h-4 accent-[var(--primary)]"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] cursor-pointer hover:border-[var(--primary)]/50 transition">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-main)]">KYC Approval & Status</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Send activation congratulations upon verification, or guidance if re-upload is required. (High Priority)</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyKyc}
                  onChange={e => setConfig({ ...config, notifyKyc: e.target.checked })}
                  className="w-4 h-4 accent-[var(--primary)]"
                />
              </label>

              <label className={`flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] transition ${config.highPriorityOnly ? 'opacity-50' : 'cursor-pointer hover:border-[var(--primary)]/50'}`}>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-main)] flex items-center gap-2">
                    <span>Trade Executions (Order Fills)</span>
                    {config.highPriorityOnly && (
                      <span className="text-[10px] text-amber-400 font-normal">(Suppressed by High-Priority Mode)</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">Send branded trade confirmation email with symbol, quantity, and fill price when an order is executed.</div>
                </div>
                <input
                  type="checkbox"
                  disabled={config.highPriorityOnly}
                  checked={!config.highPriorityOnly && config.notifyOrders}
                  onChange={e => setConfig({ ...config, notifyOrders: e.target.checked })}
                  className="w-4 h-4 accent-[var(--primary)]"
                />
              </label>
            </div>
          </div>

          {/* Super Admin Alert System Notifications */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-[var(--text-main)] flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Super Admin Instant Alerts ({config.superAdminAlertEmail || 'cyberbuzz.mail@gmail.com'})</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${config.superAdminNotificationsEnabled !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                {config.superAdminNotificationsEnabled !== false ? 'ACTIVE' : 'MUTED'}
              </span>
            </h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] cursor-pointer hover:border-emerald-500/40 transition">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-main)]">Enable Super Admin Automated Alerts</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Dispatches high-priority system alerts whenever a client registers, submits KYC documents, or submits a fund deposit/withdrawal request.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.superAdminNotificationsEnabled !== false}
                  onChange={e => setConfig({ ...config, superAdminNotificationsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  Super Admin Alert Recipient Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={config.superAdminAlertEmail ?? 'cyberbuzz.mail@gmail.com'}
                    onChange={e => setConfig({ ...config, superAdminAlertEmail: e.target.value })}
                    placeholder="cyberbuzz.mail@gmail.com"
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--text-main)] font-mono focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <span className="text-[10px] text-[var(--text-tertiary)] mt-1 block">
                  Alerts automatically sent to: <strong>cyberbuzz.mail@gmail.com</strong> on registration, KYC submission &amp; fund requests.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Send Test Email & Hostinger Info */}
        <div className="space-y-6">
          {/* Test Email Box */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2 pb-2 border-b border-[var(--border-color)]">
              <Send className="w-4 h-4 text-emerald-400" />
              <span>Send Test Email</span>
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Dispatch a test message through Hostinger SMTP to verify that emails arrive in your inbox without spam flags.
            </p>

            <div className="space-y-2">
              <input
                type="email"
                value={testEmailTo}
                onChange={e => setTestEmailTo(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={sendingTest}
                className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {sendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Test Now</span>
              </button>
            </div>
          </div>

          {/* Hostinger DNS & Domain Status Card */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-5 space-y-3 text-xs">
            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-1.5 pb-2 border-b border-[var(--border-color)]">
              <Info className="w-4 h-4 text-blue-400" />
              <span>Hostinger Domain Health</span>
            </h3>
            
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>Domain</span>
                <span className="font-semibold text-[var(--text-main)]">tradegrowx.in</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>MX Records</span>
                <span className="text-emerald-400 font-semibold">mx1.hostinger.com (Active)</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>DKIM Signature</span>
                <span className="text-emerald-400 font-semibold">hostingermail (Configured)</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>SPF Protection</span>
                <span className="text-emerald-400 font-semibold">_spf.mail.hostinger.com</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>DMARC Policy</span>
                <span className="text-emerald-400 font-semibold">Active (v=DMARC1)</span>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300">
              💡 Create mailboxes in Hostinger hPanel under <strong>Emails → tradegrowx.in</strong> (e.g. <code>info@tradegrowx.in</code>), then enter the password here.
            </div>
          </div>
        </div>
      </div>

      {/* ── MANUAL CAMPAIGNS & BULK EMAIL BROADCAST ────────────────────────── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">Manual Campaigns &amp; Email Broadcast</h3>
              <p className="text-xs text-[var(--text-muted)]">Dispatch KYC Pending reminders, offer promotions, and trade bonuses across client segments.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--text-muted)] font-medium">Target Segment:</span>
            <div className="flex p-0.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setBroadcastAudience('KYC_PENDING')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  broadcastAudience === 'KYC_PENDING'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                📋 KYC Pending
              </button>
              <button
                type="button"
                onClick={() => setBroadcastAudience('ACTIVE_USERS')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  broadcastAudience === 'ACTIVE_USERS'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                👥 Active Users
              </button>
              <button
                type="button"
                onClick={() => setBroadcastAudience('ALL')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  broadcastAudience === 'ALL'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                🌐 All Clients
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSendBroadcast} className="space-y-4">
          {/* Campaign Template Select */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
              Select Campaign Template
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setBroadcastType('KYC_REMINDER')}
                className={`p-3 rounded-xl border text-left font-semibold transition cursor-pointer flex flex-col gap-1 ${
                  broadcastType === 'KYC_REMINDER'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="text-base">📋</span>
                <span className="font-bold">KYC Pending Reminder</span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-normal">Prompt users to complete verification</span>
              </button>

              <button
                type="button"
                onClick={() => setBroadcastType('OFFER')}
                className={`p-3 rounded-xl border text-left font-semibold transition cursor-pointer flex flex-col gap-1 ${
                  broadcastType === 'OFFER'
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-sm'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="text-base">🎁</span>
                <span className="font-bold">Offer Broadcast</span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-normal">Margin discounts &amp; promo codes</span>
              </button>

              <button
                type="button"
                onClick={() => setBroadcastType('BONUS')}
                className={`p-3 rounded-xl border text-left font-semibold transition cursor-pointer flex flex-col gap-1 ${
                  broadcastType === 'BONUS'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="text-base">🚀</span>
                <span className="font-bold">First Trade Bonus</span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-normal">Welcome credits &amp; activations</span>
              </button>

              <button
                type="button"
                onClick={() => setBroadcastType('CUSTOM')}
                className={`p-3 rounded-xl border text-left font-semibold transition cursor-pointer flex flex-col gap-1 ${
                  broadcastType === 'CUSTOM'
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/40 shadow-sm'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="text-base">✉️</span>
                <span className="font-bold">Custom Broadcast</span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-normal">Freeform announcement</span>
              </button>
            </div>
          </div>

          {/* Template Details */}
          {broadcastType === 'KYC_REMINDER' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
              💡 <strong>KYC Pending Reminder Template:</strong> Automatically generates and dispatches high-priority branded emails to all clients in the selected segment who have not completed KYC verification. Includes secure 1-click KYC upload links. (Respects individual client email preference toggles).
            </div>
          )}

          {broadcastType === 'OFFER' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">Offer Title</label>
                <input
                  type="text"
                  value={broadcastOfferTitle}
                  onChange={e => setBroadcastOfferTitle(e.target.value)}
                  placeholder="e.g. Exclusive Margin Bonus & Zero Brokerage"
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">Promo Code (Optional)</label>
                <input
                  type="text"
                  value={broadcastPromoCode}
                  onChange={e => setBroadcastPromoCode(e.target.value)}
                  placeholder="TRADEGROW100"
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono uppercase text-[var(--text-main)] focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">Offer Details / Message</label>
                <textarea
                  rows={3}
                  value={broadcastBody}
                  onChange={e => setBroadcastBody(e.target.value)}
                  placeholder="Get enhanced intraday margins on Sensex and Bank Nifty contracts..."
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {broadcastType === 'BONUS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">Bonus Amount (₹)</label>
                <input
                  type="number"
                  value={broadcastBonusAmount}
                  onChange={e => setBroadcastBonusAmount(e.target.value)}
                  placeholder="1000"
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">Custom Message / Description (Optional)</label>
                <textarea
                  rows={2}
                  value={broadcastBody}
                  onChange={e => setBroadcastBody(e.target.value)}
                  placeholder="Welcome to TradeGrow! Your account activation bonus is ready for your first trade..."
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {broadcastType === 'CUSTOM' && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">Subject Line</label>
                <input
                  type="text"
                  required
                  value={broadcastSubject}
                  onChange={e => setBroadcastSubject(e.target.value)}
                  placeholder="Important System Announcement from TradeGrow"
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">Message Content (HTML / Plain text)</label>
                <textarea
                  rows={4}
                  required
                  value={broadcastBody}
                  onChange={e => setBroadcastBody(e.target.value)}
                  placeholder="Write your broadcast announcement..."
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {broadcastResult && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              broadcastResult.success ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}>
              {broadcastResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{broadcastResult.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
            <span className="text-[11px] text-[var(--text-tertiary)]">
              ⚠️ Emails are sent in background batches to prevent rate limits.
            </span>
            <button
              type="submit"
              disabled={broadcasting}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-md shadow-purple-600/30 cursor-pointer flex items-center gap-1.5"
            >
              {broadcasting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Megaphone className="w-3.5 h-3.5" />}
              <span>{broadcasting ? 'Initiating Broadcast...' : 'Dispatch Broadcast Now'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Delivery Logs Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
          <h3 className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2">
            <Mail className="w-4 h-4 text-[var(--primary)]" />
            <span>Recent Email Delivery Logs</span>
          </h3>
          <button
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--text-tertiary)]">
            No emails dispatched yet. Click "Send Test Now" above to test delivery.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="py-2 px-3">Recipient</th>
                  <th className="py-2 px-3">Subject</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-[var(--bg-surface-elevated)]/50 transition">
                    <td className="py-2 px-3 font-mono text-[11px] text-[var(--text-main)]">{log.to_email}</td>
                    <td className="py-2 px-3 text-[var(--text-muted)] truncate max-w-xs">{log.subject}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300">
                        {log.template_type}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        log.status === 'SENT' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : log.status === 'SKIPPED'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-[10px] text-[var(--text-tertiary)]">
                      {new Date(log.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
