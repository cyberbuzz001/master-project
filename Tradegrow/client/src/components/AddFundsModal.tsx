import React, { useState, useEffect } from 'react';
import {
  Wallet, X, Plus, CheckCircle2, AlertCircle, ArrowUpRight, Copy, Check,
  Smartphone, Building2, ShieldCheck, Clock, RefreshCw, ChevronRight
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { launchUpiApp, SupportedUpiApp } from '../utils/upiPayment';

export interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance: number;
  userToken: string;
  username?: string;
  onSuccess?: () => void;
}

const PRESET_AMOUNTS = [1000, 5000, 10000, 25000];

export const AddFundsModal: React.FC<AddFundsModalProps> = ({
  isOpen,
  onClose,
  walletBalance,
  userToken,
  username = 'Trader',
  onSuccess,
}) => {
  const [amount, setAmount] = useState<string>('5000');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK'>('UPI');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'DEPOSIT' | 'HISTORY'>('DEPOSIT');
  const [fundHistory, setFundHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const upiVpa = 'expertstokks@axl';
  const virtualAccount = 'TGROW987654321';
  const bankIfsc = 'UTIB0000123';
  const bankName = 'Axis Bank Ltd';

  useEffect(() => {
    if (isOpen && activeTab === 'HISTORY') {
      fetchHistory();
    }
  }, [isOpen, activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/v1/portfolio/funds/history', {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.transactions)) {
        setFundHistory(data.transactions);
      }
    } catch (_) {}
    finally {
      setLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePresetClick = (val: number) => {
    setAmount(val.toString());
    setFeedbackMsg(null);
  };

  const handleUpiAppClick = async (app: SupportedUpiApp) => {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a valid deposit amount (min ₹1)' });
      return;
    }

    launchUpiApp(app, {
      upiId: upiVpa,
      merchantName: 'TradeGrow Brokerage',
      amount: num,
      note: `Deposit ${username}`
    });
  };

  const handleSimulateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a valid deposit amount (min ₹1)' });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch('/api/v1/portfolio/funds/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          amount: num,
          paymentMethod,
          utrNumber: `SIM${Date.now().toString().slice(-8)}`
        })
      });

      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({
          type: 'success',
          text: `🎉 ₹${num.toLocaleString('en-IN')} added successfully to your trading balance!`
        });
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
          setFeedbackMsg(null);
        }, 1800);
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.error?.message || 'Transaction could not be completed. Please try again.'
        });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Network error during payment' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[var(--bg-surface)] border-t sm:border border-[var(--border-color)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] pb-[env(safe-area-inset-bottom,12px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden w-10 h-1 bg-[var(--border-color)] rounded-full mx-auto mt-2.5 mb-1" />

        {/* Header */}
        <div className="p-3 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">Add Trading Funds</h2>
              <p className="text-xs text-[var(--text-muted)] font-medium">Instant credit with ₹0 convenience fee</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs: Add Funds vs History */}
        <div className="flex border-b border-[var(--border-color)] px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('DEPOSIT')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'DEPOSIT'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Deposit Money
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'HISTORY'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Fund History
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 flex-1">
          {activeTab === 'DEPOSIT' ? (
            <>
              {/* Available Balance Pill */}
              <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Available Balance</span>
                  <span className="text-lg font-black font-mono text-[var(--text-main)]">
                    ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <Badge variant="gain" dot>
                  ACTIVE
                </Badge>
              </div>

              {/* Feedback Alert */}
              {feedbackMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    feedbackMsg.type === 'success'
                      ? 'bg-[var(--gain-light)] text-[var(--gain)] border border-[var(--gain)]/30'
                      : 'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]/30'
                  }`}
                >
                  {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider block">
                  Amount to Add
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-[var(--text-muted)]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="5000"
                    className="w-full pl-9 pr-4 py-3 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-2xl text-lg font-black font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-all"
                  />
                </div>

                {/* Preset Amount Chips */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-1">
                  {PRESET_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handlePresetClick(val)}
                      className={`py-1 sm:py-1.5 px-1 sm:px-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold border transition-all cursor-pointer ${
                        amount === val.toString()
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                          : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      +₹{val >= 1000 ? `${val / 1000}k` : val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method Switcher */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider block">
                  Choose Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      paymentMethod === 'UPI'
                        ? 'bg-[var(--bg-surface-elevated)] border-[var(--primary)] shadow-sm'
                        : 'border-[var(--border-color)] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black block text-[var(--text-main)]">Instant UPI</span>
                      <span className="text-[10px] text-[var(--text-muted)] block">Google Pay, PhonePe</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK')}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      paymentMethod === 'BANK'
                        ? 'bg-[var(--bg-surface-elevated)] border-[var(--primary)] shadow-sm'
                        : 'border-[var(--border-color)] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black block text-[var(--text-main)]">Bank Transfer</span>
                      <span className="text-[10px] text-[var(--text-muted)] block">IMPS / NEFT / RTGS</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* UPI Sub-Options */}
              {paymentMethod === 'UPI' ? (
                <div className="space-y-3 p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
                  <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase block">
                    1-Tap Launch UPI App
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'gpay', name: 'GPay', color: 'text-blue-500 border-blue-500/30' },
                      { id: 'phonepe', name: 'PhonePe', color: 'text-purple-500 border-purple-500/30' },
                      { id: 'paytm', name: 'Paytm', color: 'text-cyan-500 border-cyan-500/30' },
                      { id: 'bhim', name: 'BHIM', color: 'text-emerald-500 border-emerald-500/30' },
                    ].map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => handleUpiAppClick(app.id as SupportedUpiApp)}
                        className={`p-2 rounded-xl border bg-[var(--bg-surface)] text-xs font-black flex flex-col items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer ${app.color}`}
                      >
                        <span>{app.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block">TradeGrow Merchant VPA:</span>
                      <span className="font-mono font-bold text-[var(--text-main)]">{upiVpa}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(upiVpa, 'vpa')}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] text-[11px] font-bold flex items-center gap-1 hover:text-[var(--primary)]"
                    >
                      {copiedField === 'vpa' ? <Check className="w-3.5 h-3.5 text-[var(--gain)]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'vpa' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Bank Transfer Info */
                <div className="space-y-2.5 p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-[var(--border-color)]">
                    <span className="text-[var(--text-muted)] font-medium">Virtual A/C Number:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[var(--text-main)]">{virtualAccount}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(virtualAccount, 'acc')}
                        className="p-1 hover:text-[var(--primary)]"
                      >
                        {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-[var(--gain)]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[var(--border-color)]">
                    <span className="text-[var(--text-muted)] font-medium">IFSC Code:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[var(--text-main)]">{bankIfsc}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(bankIfsc, 'ifsc')}
                        className="p-1 hover:text-[var(--primary)]"
                      >
                        {copiedField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-[var(--gain)]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[var(--text-muted)] font-medium">Bank Name:</span>
                    <span className="font-bold text-[var(--text-main)]">{bankName}</span>
                  </div>
                </div>
              )}

              {/* Transparency Notice */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Transfer Guarantees</span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] leading-tight space-y-0.5">
                  <p>• Zero convenience fees charged on deposits.</p>
                  <p>• Verified instant credit within 30 seconds.</p>
                  <p>• Standard UPI limits: Up to ₹1,00,000 per transaction.</p>
                </div>
              </div>
            </>
          ) : (
            /* HISTORY TAB */
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[var(--primary)]" />
                  <span className="text-xs text-[var(--text-muted)] font-bold">Loading fund history...</span>
                </div>
              ) : fundHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-1">
                  <Clock className="w-8 h-8 mx-auto opacity-40 mb-2" />
                  <p className="font-bold">No fund transactions yet</p>
                  <p className="text-[11px]">Your deposits and withdrawals will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-color)]">
                  {fundHistory.map((tx) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[var(--text-main)]">
                            {tx.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}
                          </span>
                          <Badge variant={tx.status === 'APPROVED' || tx.status === 'SUCCESS' ? 'gain' : tx.status === 'PENDING' ? 'warning' : 'loss'}>
                            {tx.status}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">
                          {new Date(tx.createdAt || tx.created_at).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-right font-mono font-bold text-xs">
                        <span className={tx.type === 'DEPOSIT' ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}>
                          {tx.type === 'DEPOSIT' ? '+' : '-'}₹{parseFloat(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Submit Button */}
        {activeTab === 'DEPOSIT' && (
          <div className="p-4 sm:p-5 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSimulateDeposit}
              className="w-full py-3.5 px-4 rounded-2xl text-sm font-black bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <span>Deposit ₹{parseFloat(amount || '0').toLocaleString('en-IN')} Instantly</span>
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

