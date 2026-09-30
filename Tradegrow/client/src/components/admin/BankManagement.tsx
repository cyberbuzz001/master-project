import React, { useState, useEffect, useRef } from 'react';
import {
  Building, QrCode, CreditCard, DollarSign, UploadCloud, Save, RefreshCw,
  Copy, Check, AlertCircle, CheckCircle2, Trash2, Plus, ExternalLink,
  Lock, Eye, Image as ImageIcon, RotateCcw, Smartphone, ShieldCheck
} from 'lucide-react';

interface QuickPayItem {
  amount: number;
  url: string;
  label?: string;
}

interface BankSettingsState {
  upiId: string;
  merchantName: string;
  qrImageUrl: string;
  quickPayLinks: QuickPayItem[];
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
}

const DEFAULT_QUICK_PAY_LINKS: QuickPayItem[] = [
  { amount: 1000, url: 'https://onetapay.com/pp/MjkzNw==' },
  { amount: 5000, url: 'https://onetapay.com/pp/MjkzNQ==' },
  { amount: 10000, url: 'https://onetapay.com/pp/MjkzNg==' }
];

interface BankManagementProps {
  token: string;
}

export const BankManagement: React.FC<BankManagementProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [settings, setSettings] = useState<BankSettingsState>({
    upiId: 'expertstokks@axl',
    merchantName: 'Trade Grow Brokerage',
    qrImageUrl: '/upi-qr.png',
    quickPayLinks: DEFAULT_QUICK_PAY_LINKS,
    bankName: 'HDFC Bank',
    accountName: 'Trade Grow Technologies Pvt Ltd',
    accountNumber: '50200098765432',
    ifscCode: 'HDFC0001234',
    branch: 'Mumbai Main Branch'
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/funds/payment-settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings({
          upiId: data.settings.upiId || 'expertstokks@axl',
          merchantName: data.settings.merchantName || 'Trade Grow Brokerage',
          qrImageUrl: data.settings.qrImageUrl || '/upi-qr.png',
          quickPayLinks: Array.isArray(data.settings.quickPayLinks) && data.settings.quickPayLinks.length > 0
            ? data.settings.quickPayLinks
            : DEFAULT_QUICK_PAY_LINKS,
          bankName: data.settings.bankName || 'HDFC Bank',
          accountName: data.settings.accountName || 'Trade Grow Technologies Pvt Ltd',
          accountNumber: data.settings.accountNumber || '50200098765432',
          ifscCode: data.settings.ifscCode || 'HDFC0001234',
          branch: data.settings.branch || 'Mumbai Main Branch'
        });
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 500KB)
    if (file.size > 500 * 1024) {
      setMsg({ type: 'error', text: 'QR code image must be less than 500 KB' });
      return;
    }

    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setMsg({ type: 'error', text: 'Please upload a valid image file (PNG, JPG, WEBP, or SVG)' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSettings(prev => ({ ...prev, qrImageUrl: reader.result as string }));
        setMsg({ type: 'success', text: '✅ QR Code image loaded in preview! Click Save to apply.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddQuickPay = () => {
    setSettings(prev => ({
      ...prev,
      quickPayLinks: [...prev.quickPayLinks, { amount: 2000, url: 'https://onetapay.com/pp/' }]
    }));
  };

  const handleUpdateQuickPay = (index: number, field: 'amount' | 'url', value: any) => {
    setSettings(prev => {
      const updated = [...prev.quickPayLinks];
      if (field === 'amount') {
        updated[index] = { ...updated[index], amount: Math.max(1, parseInt(value, 10) || 0) };
      } else {
        updated[index] = { ...updated[index], url: value };
      }
      return { ...prev, quickPayLinks: updated };
    });
  };

  const handleRemoveQuickPay = (index: number) => {
    setSettings(prev => ({
      ...prev,
      quickPayLinks: prev.quickPayLinks.filter((_, i) => i !== index)
    }));
  };

  const handleResetQuickPay = () => {
    setSettings(prev => ({
      ...prev,
      quickPayLinks: DEFAULT_QUICK_PAY_LINKS
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/v1/admin/funds/payment-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: '✅ Merchant payment receiving credentials (UPI, QR & Bank) saved successfully!' });
      } else {
        setMsg({ type: 'error', text: data.error?.message || 'Failed to update payment settings' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Network error updating settings' });
    } finally {
      setSaving(false);
    }
  };

  const copyUpi = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-[var(--text-muted)]">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--primary)]" />
        <span className="text-xs font-semibold">Loading Merchant Payment Configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[var(--bg-surface)] via-[var(--bg-surface)]/95 to-[var(--primary-light)]/30 border border-[var(--border-color)] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                <Building className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-[var(--text-main)] tracking-tight flex items-center gap-2">
                Merchant Bank & UPI Management
                <span className="text-[10px] font-bold text-[var(--warning)] bg-[var(--warning)]/10 px-2.5 py-0.5 rounded-full border border-[var(--warning)]/20 uppercase tracking-widest flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Admin Protected
                </span>
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Configure merchant receiving UPI VPA, static QR code image, quick-pay links, and bank wire settlement account for client fund deposits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[var(--bg-body)]/90 px-4 py-2 rounded-xl border border-[var(--border-color)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse"></span>
              <span className="text-xs font-mono font-bold text-[var(--primary)]">{settings.upiId}</span>
            </div>
            <button
              onClick={fetchSettings}
              className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-inset)] text-[var(--text-muted)] transition"
              title="Refresh Settings"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30' : 'bg-[var(--loss)]/10 text-[var(--loss)] border border-[var(--loss)]/30'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Grid: Left = Form Configuration, Right = Live Customer Deposit Page Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Section 1: Merchant UPI & QR Code */}
            <div className="bg-[var(--bg-surface)]/90 border border-[var(--border-color)] rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
                <QrCode className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-xs font-extrabold text-[var(--text-main)] tracking-wider uppercase">
                  1. Merchant UPI ID & Static QR Code
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="admin-upi-id" className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span>Merchant UPI VPA / ID</span>
                    <span className="text-[9px] text-[var(--primary)] font-mono">Receives Deposits</span>
                  </label>
                  <div className="relative">
                    <input
                      id="admin-upi-id"
                      type="text"
                      value={settings.upiId}
                      onChange={e => setSettings({ ...settings, upiId: e.target.value })}
                      placeholder="e.g. expertstokks@axl"
                      required
                      className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-[var(--primary)] focus:outline-none focus:border-[var(--primary)] transition shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => copyUpi(settings.upiId)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded-lg transition"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-[var(--primary)]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="admin-merchant-name" className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                    Merchant Business Display Name
                  </label>
                  <input
                    id="admin-merchant-name"
                    type="text"
                    value={settings.merchantName}
                    onChange={e => setSettings({ ...settings, merchantName: e.target.value })}
                    placeholder="e.g. Trade Grow Brokerage"
                    required
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3.5 py-2 text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition"
                  />
                </div>
              </div>

              {/* QR Image Upload & Preview */}
              <div className="pt-2 border-t border-[var(--border-color)]">
                <label className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                  Static Payment QR Code Image
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-[var(--bg-body)]/80 p-3.5 rounded-xl border border-[var(--border-color)]">
                  <div className="w-24 h-24 rounded-xl border border-[var(--border-color)] bg-white p-1.5 flex items-center justify-center shrink-0 shadow-sm">
                    <img
                      src={settings.qrImageUrl || '/upi-qr.png'}
                      alt="Merchant UPI QR"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/upi-qr.png';
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Upload a crisp PNG, JPG, WEBP, or SVG image (max 500 KB). This static QR code will be displayed to clients on the Deposit Funds page.
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        onChange={handleQrUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-on-accent)] text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload New QR Image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, qrImageUrl: '/upi-qr.png' }))}
                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-inset)] text-[var(--text-muted)] text-[11px] font-semibold flex items-center gap-1.5 transition border border-[var(--border-color)] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset to Default QR</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Quick Pay Direct Hosted Links */}
            <div className="bg-[var(--bg-surface)]/90 border border-[var(--border-color)] rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-[var(--primary)]" />
                  <h3 className="text-xs font-extrabold text-[var(--text-main)] tracking-wider uppercase">
                    2. Quick-Pay Hosted Payment Links
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetQuickPay}
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold transition flex items-center gap-1"
                    title="Reset to default 3 links"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Defaults</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddQuickPay}
                    className="px-2.5 py-1 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 hover:bg-[var(--primary)]/20 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Link</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {settings.quickPayLinks.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-center gap-2 bg-[var(--bg-body)]/60 p-2.5 rounded-xl border border-[var(--border-color)]">
                    <div className="w-full sm:w-32 shrink-0">
                      <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        min="1"
                        value={item.amount}
                        onChange={e => handleUpdateQuickPay(idx, 'amount', e.target.value)}
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[var(--gain)] focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-1">Hosted Payment URL</label>
                      <input
                        type="url"
                        value={item.url}
                        onChange={e => handleUpdateQuickPay(idx, 'url', e.target.value)}
                        placeholder="https://onetapay.com/pp/..."
                        required
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 self-end sm:self-center mt-2 sm:mt-4 shrink-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-inset)] text-[var(--primary)] transition border border-[var(--border-color)]"
                        title="Test link in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuickPay(idx)}
                        disabled={settings.quickPayLinks.length <= 1}
                        className="p-1.5 rounded-lg bg-[var(--loss)]/10 text-[var(--loss)] hover:bg-[var(--loss)]/20 transition disabled:opacity-30 cursor-pointer"
                        title="Remove link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Merchant Bank Wire Backup */}
            <div className="bg-[var(--bg-surface)]/90 border border-[var(--border-color)] rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
                <CreditCard className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-xs font-extrabold text-[var(--text-main)] tracking-wider uppercase">
                  3. Merchant Bank Account (Wire Transfer Backup)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="admin-bank-name" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Bank Name</label>
                  <input
                    id="admin-bank-name"
                    type="text"
                    value={settings.bankName}
                    onChange={e => setSettings({ ...settings, bankName: e.target.value })}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label htmlFor="admin-account-name" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Account Holder Name</label>
                  <input
                    id="admin-account-name"
                    type="text"
                    value={settings.accountName}
                    onChange={e => setSettings({ ...settings, accountName: e.target.value })}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label htmlFor="admin-account-number" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Account Number</label>
                  <input
                    id="admin-account-number"
                    type="text"
                    value={settings.accountNumber}
                    onChange={e => setSettings({ ...settings, accountNumber: e.target.value })}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[var(--primary)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label htmlFor="admin-ifsc" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">IFSC Code</label>
                  <input
                    id="admin-ifsc"
                    type="text"
                    value={settings.ifscCode}
                    onChange={e => setSettings({ ...settings, ifscCode: e.target.value.toUpperCase() })}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[var(--warning)] focus:outline-none focus:border-[var(--primary)] uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="admin-branch" className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Branch Location</label>
                  <input
                    id="admin-branch"
                    type="text"
                    value={settings.branch}
                    onChange={e => setSettings({ ...settings, branch: e.target.value })}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-on-accent)] font-black text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Merchant Settings...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Merchant Bank & Payment Settings</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Customer Deposit Page Live Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[var(--bg-surface)]/90 border border-[var(--border-color)] rounded-2xl p-5 shadow-lg space-y-4 sticky top-6">
            
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-xs font-extrabold text-[var(--text-main)] tracking-wider uppercase">
                  Customer Deposit Page Preview
                </h3>
              </div>
              <span className="text-[9px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2.5 py-0.5 rounded-full border border-[var(--primary)]/20">
                Live Preview
              </span>
            </div>

            {/* Preview Container mirroring ProfilePage Funds Deposit flow */}
            <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border-color)] space-y-4 shadow-inner">
              
              {/* Header inside preview */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[var(--gain)]/10 text-[var(--gain)]">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-[var(--text-main)] block">UPI Deposit</span>
                    <span className="text-[10px] text-[var(--text-muted)] block">Instant credit on approval</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[var(--gain)] bg-[var(--gain-light)] px-2 py-0.5 rounded-full border border-[var(--gain)]/30">
                  Zero Fees
                </span>
              </div>

              {/* QR Code + Payee Box */}
              <div className="flex flex-col sm:flex-row items-center gap-3.5 bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
                <div className="w-28 h-28 bg-white p-1.5 rounded-xl border border-[var(--border-color)] shrink-0 flex items-center justify-center shadow-xs">
                  <img
                    src={settings.qrImageUrl || '/upi-qr.png'}
                    alt="Customer QR Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/upi-qr.png'; }}
                  />
                </div>
                <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                  <div>
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Merchant Payee</span>
                    <span className="text-xs font-bold text-[var(--text-main)] block">{settings.merchantName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">UPI VPA</span>
                    <div className="inline-flex items-center gap-1 bg-[var(--bg-body)] px-2 py-1 rounded-lg border border-[var(--border-color)] mt-0.5">
                      <span className="text-[11px] font-mono font-bold text-[var(--primary)]">{settings.upiId}</span>
                      <button
                        type="button"
                        onClick={() => copyUpi(settings.upiId)}
                        className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5"
                        title="Copy"
                      >
                        {copiedUpi ? <Check className="w-3 h-3 text-[var(--primary)]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Pay Buttons Grid in Preview */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider block">
                  Quick Pay Instant Links:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {settings.quickPayLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-[var(--primary)]/40 flex flex-col items-center justify-center gap-1 transition shadow-xs group"
                    >
                      <span className="text-xs font-mono font-extrabold text-[var(--gain)]">
                        ₹{link.amount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[9px] font-bold text-[var(--text-muted)] group-hover:text-[var(--primary)] flex items-center gap-0.5 transition-colors">
                        <span>Pay Direct</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Notice */}
              <div className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)] p-2.5 rounded-xl border border-[var(--border-color)] leading-relaxed">
                ℹ️ Customers scan the QR, copy the UPI ID, or click a Quick Pay card. After payment, they enter the reference UTR number below to submit deposit proof.
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
