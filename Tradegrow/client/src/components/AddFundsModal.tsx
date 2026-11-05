import React, { useState, useEffect, useRef } from 'react';
import {
  Wallet, X, Check, Copy, ExternalLink, ArrowDownLeft, ArrowUpRight,
  Clock, RefreshCw, Upload, Image as ImageIcon, Trash2, CheckCircle2,
  AlertCircle, ShieldCheck
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { launchUpiApp, SupportedUpiApp } from '../utils/upiPayment';
import { soundManager } from '../utils/soundManager';

export interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance: number;
  userToken: string;
  username?: string;
  onSuccess?: () => void;
}

const PRESET_AMOUNTS = [1000, 5000, 10000, 25000];

const GPayIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

const PhonePeIcon = () => (
  <div className="w-5 h-5 rounded-full bg-[#5f259f] flex items-center justify-center text-white font-black text-[11px] shadow-xs">
    पे
  </div>
);

const PaytmIcon = () => (
  <div className="w-5 h-5 rounded-full bg-[#002e6e] flex items-center justify-center text-[#00baf2] font-black text-[9px] tracking-tighter shadow-xs">
    Paytm
  </div>
);

const BhimIcon = () => (
  <div className="w-5 h-5 rounded-full bg-[#00897b] flex items-center justify-center text-white font-black text-[8px] shadow-xs">
    BHIM
  </div>
);

// Client-side image compressor for payment screenshots (ensures <150KB)
const compressScreenshot = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to parse image'));
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const AddFundsModal: React.FC<AddFundsModalProps> = ({
  isOpen,
  onClose,
  walletBalance,
  userToken,
  username = 'Trader',
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'DEPOSIT' | 'HISTORY'>('DEPOSIT');
  const [amount, setAmount] = useState<string>('5000');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [screenshotData, setScreenshotData] = useState<{ name: string; size: string; dataUrl: string } | null>(null);
  const [compressingImage, setCompressingImage] = useState<boolean>(false);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merchant & Payment configuration
  const [paymentConfig, setPaymentConfig] = useState<{
    upiId: string;
    merchantName: string;
    qrImageUrl: string;
    quickPayLinks: { amount: number; url: string; label?: string }[];
  }>({
    upiId: 'expertstokks@axl',
    merchantName: 'Trade Grow Brokerage',
    qrImageUrl: '/upi-qr.png',
    quickPayLinks: [
      { amount: 1000, url: 'https://onetapay.com/pp/MjkzNw==' },
      { amount: 5000, url: 'https://onetapay.com/pp/MjkzNQ==' },
      { amount: 10000, url: 'https://onetapay.com/pp/MjkzNg==' }
    ]
  });

  const [fundHistory, setFundHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchPaymentSettings();
    if (activeTab === 'HISTORY') {
      fetchHistory();
    }
  }, [isOpen, activeTab]);

  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch('/api/v1/funds/payment-settings', {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setPaymentConfig({
          upiId: data.settings.upiId || 'expertstokks@axl',
          merchantName: data.settings.merchantName || 'Trade Grow Brokerage',
          qrImageUrl: data.settings.qrImageUrl || '/upi-qr.png',
          quickPayLinks: Array.isArray(data.settings.quickPayLinks) && data.settings.quickPayLinks.length > 0
            ? data.settings.quickPayLinks
            : [
              { amount: 1000, url: 'https://onetapay.com/pp/MjkzNw==' },
              { amount: 5000, url: 'https://onetapay.com/pp/MjkzNQ==' },
              { amount: 10000, url: 'https://onetapay.com/pp/MjkzNg==' }
            ]
        });
      }
    } catch (_) {}
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/v1/funds/requests', {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setFundHistory(data.requests);
      }
    } catch (_) {}
    finally {
      setLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;

  const handleCopyUpi = () => {
    navigator.clipboard?.writeText(paymentConfig.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handlePresetClick = (val: number) => {
    setAmount(val.toString());
    setFeedbackMsg(null);
  };

  const handleUpiAppClick = (app: SupportedUpiApp) => {
    if (numAmount <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a valid deposit amount (minimum ₹1)' });
      return;
    }
    launchUpiApp(app, {
      upiId: paymentConfig.upiId,
      merchantName: paymentConfig.merchantName,
      amount: numAmount,
      note: `Deposit ${username}`
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedbackMsg({ type: 'error', text: 'Please select a valid image file (JPG, PNG, WEBP)' });
      return;
    }

    setCompressingImage(true);
    try {
      const compressedDataUrl = await compressScreenshot(file);
      const approxKb = Math.round(compressedDataUrl.length * 0.75 / 1024);
      setScreenshotData({
        name: file.name,
        size: `${approxKb} KB`,
        dataUrl: compressedDataUrl
      });
      setFeedbackMsg(null);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Could not process screenshot image. Please try another image.' });
    } finally {
      setCompressingImage(false);
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshotData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a valid deposit amount greater than ₹0' });
      return;
    }

    const cleanUtr = utrNumber.trim();
    if (!cleanUtr && !screenshotData) {
      setFeedbackMsg({
        type: 'error',
        text: 'Please enter the 12-digit UTR reference number or upload your payment screenshot'
      });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      // Build note with UTR and compressed screenshot data URL
      let refNote = cleanUtr ? `UTR: ${cleanUtr}` : 'Payment Screenshot Provided';
      if (screenshotData?.dataUrl) {
        refNote += `\nScreenshot: ${screenshotData.dataUrl}`;
      }

      const res = await fetch('/api/v1/funds/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          requestType: 'DEPOSIT',
          amount: numAmount,
          paymentMethod: 'UPI',
          referenceNote: refNote
        })
      });

      const data = await res.json();
      if (data.success) {
        soundManager.playSound('payment_success');
        setFeedbackMsg({
          type: 'success',
          text: `Deposit request of ₹${numAmount.toLocaleString('en-IN')} submitted! Funds will be credited once verified.`
        });
        setUtrNumber('');
        setScreenshotData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (onSuccess) onSuccess();
        window.dispatchEvent(new CustomEvent('fund-request-submitted'));

        setTimeout(() => {
          onClose();
          setFeedbackMsg(null);
        }, 2200);
      } else {
        soundManager.playSound('payment_failed');
        setFeedbackMsg({
          type: 'error',
          text: data.error?.message || data.message || 'Failed to submit deposit request. Please try again.'
        });
      }
    } catch (err: any) {
      soundManager.playSound('payment_failed');
      setFeedbackMsg({ type: 'error', text: err.message || 'Network error while submitting deposit request' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic QR code for exact amount prefill with fallback to configured merchant image
  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=4&data=${encodeURIComponent(
    `upi://pay?pa=${paymentConfig.upiId}&pn=${encodeURIComponent(paymentConfig.merchantName)}&am=${numAmount > 0 ? numAmount.toFixed(2) : '1.00'}&cu=INR&tn=${encodeURIComponent(`Deposit ${username}`)}`
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[var(--bg-surface)] border-t sm:border border-[var(--border-color)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] pb-[env(safe-area-inset-bottom,12px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden w-12 h-1.5 bg-[var(--border-color)] rounded-full mx-auto mt-2.5 mb-1" />

        {/* Modal Header */}
        <div className="p-3.5 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">Deposit Trading Funds</h2>
              <p className="text-[11px] text-[var(--text-muted)] font-medium">Instant credit with ₹0 convenience fee</p>
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

        {/* Top Navigation Tabs: Add Funds vs History */}
        <div className="flex border-b border-[var(--border-color)] px-4 pt-2 bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={() => setActiveTab('DEPOSIT')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'DEPOSIT'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Add Funds
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'HISTORY'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Deposit History
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'DEPOSIT' ? (
            <form onSubmit={handleSubmitDeposit} className="space-y-4">
              {/* Current Margin Pill */}
              <div className="p-3 rounded-xl sm:rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Current Available Margin</span>
                  <span className="text-base sm:text-lg font-black font-mono text-[var(--text-main)]">
                    ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <Badge variant="gain" dot className="text-[10px] py-0.5 px-2">
                  Active
                </Badge>
              </div>

              {/* Feedback Alert */}
              {feedbackMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    feedbackMsg.type === 'success'
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                  }`}
                >
                  {feedbackMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              {/* STEP 1: ENTER AMOUNT */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[var(--text-main)] uppercase tracking-wider">
                    Step 1: Enter Amount
                  </label>
                  <span className="text-[11px] text-[var(--text-muted)]">Zero surcharge</span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl font-black text-[var(--text-muted)]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setFeedbackMsg(null);
                    }}
                    placeholder="5000"
                    className="w-full pl-9 pr-4 py-2.5 sm:py-3 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] focus:border-emerald-500 rounded-xl sm:rounded-2xl text-base sm:text-lg font-black font-mono text-[var(--text-main)] focus:outline-none transition-all"
                  />
                </div>

                {/* Quick Preset Pills */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-0.5">
                  {PRESET_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handlePresetClick(val)}
                      className={`py-1.5 px-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold font-mono border transition-all cursor-pointer ${
                        amount === val.toString()
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                          : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      +₹{val >= 1000 ? `${val / 1000}k` : val}
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 2: SCAN QR OR COPY UPI ID */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[var(--text-main)] uppercase tracking-wider">
                    Step 2: Pay via UPI QR / UPI ID
                  </span>
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Instant
                  </span>
                </div>

                {/* QR Code & Merchant VPA Display */}
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
                  <div className="w-32 h-32 bg-white p-1.5 rounded-xl border border-[var(--border-color)] shrink-0 flex items-center justify-center shadow-xs">
                    <img
                      src={dynamicQrUrl}
                      alt="UPI QR Code"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = paymentConfig.qrImageUrl || '/upi-qr.png';
                      }}
                    />
                  </div>

                  <div className="flex-1 w-full text-center sm:text-left space-y-2">
                    <div>
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                        Merchant UPI ID (VPA)
                      </span>
                      <div className="mt-1 flex items-center justify-center sm:justify-start gap-2">
                        <span className="text-xs font-mono font-black text-emerald-500 bg-[var(--bg-surface-elevated)] px-2.5 py-1 rounded-lg border border-[var(--border-color)] select-all">
                          {paymentConfig.upiId}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                          title="Copy UPI ID"
                        >
                          {copiedUpi ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy ID</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                      Scan this QR code or copy the UPI ID into your payment app (Google Pay, PhonePe, Paytm, BHIM) to complete payment.
                    </p>
                  </div>
                </div>

                {/* 1-Tap UPI Apps Launcher */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">
                    Or Tap to Launch UPI App
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpiAppClick('gpay')}
                      className="p-2 sm:p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-blue-500 flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow-2xs cursor-pointer"
                    >
                      <GPayIcon />
                      <span className="text-[10.5px] font-bold text-[var(--text-main)]">GPay</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpiAppClick('phonepe')}
                      className="p-2 sm:p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-purple-500 flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow-2xs cursor-pointer"
                    >
                      <PhonePeIcon />
                      <span className="text-[10.5px] font-bold text-[var(--text-main)]">PhonePe</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpiAppClick('paytm')}
                      className="p-2 sm:p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-sky-500 flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow-2xs cursor-pointer"
                    >
                      <PaytmIcon />
                      <span className="text-[10.5px] font-bold text-[var(--text-main)]">Paytm</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpiAppClick('bhim')}
                      className="p-2 sm:p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-emerald-500 flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow-2xs cursor-pointer"
                    >
                      <BhimIcon />
                      <span className="text-[10.5px] font-bold text-[var(--text-main)]">BHIM</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* OTHER OPTION: QUICK-PAY HOSTED PAYMENT LINKS */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-black text-[var(--text-main)] uppercase tracking-wider">
                      Other Option: Pay via Payment Link
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    Cards &amp; NetBanking
                  </span>
                </div>

                <p className="text-[11px] text-[var(--text-muted)]">
                  Use our secure Quick-Pay hosted links to pay via UPI, Debit/Credit Card, or NetBanking:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {paymentConfig.quickPayLinks.map((link) => (
                    <a
                      key={link.amount}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-blue-500/5 border border-[var(--border-color)] hover:border-blue-500/40 flex items-center justify-between group transition cursor-pointer"
                    >
                      <div>
                        <span className="text-xs font-black font-mono text-[var(--text-main)] block">
                          ₹{link.amount.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9.5px] text-[var(--text-muted)]">Quick-Pay Link</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-blue-500 transition" />
                    </a>
                  ))}
                </div>
              </div>

              {/* STEP 3: SUBMIT UTR OR PAYMENT SCREENSHOT */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[var(--text-main)] uppercase tracking-wider">
                    Step 3: Confirm Deposit
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">Enter UTR or upload proof</span>
                </div>

                {/* UTR Input */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-[var(--text-muted)] uppercase block">
                    12-Digit UTR / Transaction Reference Number
                  </label>
                  <input
                    type="text"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/\s+/g, ''))}
                    placeholder="e.g. 431289102834"
                    maxLength={24}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-emerald-500 rounded-xl text-xs sm:text-sm font-mono font-bold text-[var(--text-main)] focus:outline-none transition"
                  />
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Available in your UPI app's transaction details after payment.
                  </p>
                </div>

                {/* Payment Screenshot Upload */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10.5px] font-bold text-[var(--text-muted)] uppercase block">
                    Or Upload Payment Screenshot (Optional)
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="deposit-screenshot-input"
                  />

                  {screenshotData ? (
                    <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-emerald-500/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <img
                          src={screenshotData.dataUrl}
                          alt="Payment Screenshot Preview"
                          className="w-10 h-10 object-cover rounded-lg border border-[var(--border-color)] flex-shrink-0"
                        />
                        <div className="overflow-hidden">
                          <span className="text-xs font-bold text-[var(--text-main)] block truncate">
                            {screenshotData.name}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            {screenshotData.size} • Ready to submit
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveScreenshot}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Remove Screenshot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="deposit-screenshot-input"
                      className="p-3 rounded-xl border border-dashed border-[var(--border-color)] hover:border-emerald-500/50 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] flex items-center justify-center gap-2 cursor-pointer transition text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    >
                      {compressingImage ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                          <span>Compressing screenshot...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-emerald-500" />
                          <span>Tap to upload receipt / screenshot</span>
                        </>
                      )}
                    </label>
                  )}
                </div>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={isSubmitting || numAmount <= 0}
                className="w-full py-3.5 px-4 rounded-xl sm:rounded-2xl text-sm font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-md active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Deposit Request...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Deposit Request (₹{numAmount.toLocaleString('en-IN')})</span>
                    <ArrowDownLeft className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Guarantees Notice */}
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span className="text-[11px] font-medium leading-tight text-[var(--text-muted)]">
                  Zero convenience fees. Funds are credited instantly to your trading margin upon confirmation.
                </span>
              </div>
            </form>
          ) : (
            /* HISTORY TAB WITH OPTIMIZED TRANSACTION CARDS & MONOSPACE AMOUNT FONT */
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                  <span className="text-xs text-[var(--text-muted)] font-bold">Loading fund history...</span>
                </div>
              ) : fundHistory.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-muted)] space-y-1">
                  <Clock className="w-8 h-8 mx-auto opacity-40 mb-2" />
                  <p className="font-bold text-sm text-[var(--text-main)]">No deposit requests recorded</p>
                  <p className="text-[11px]">When you submit a deposit request, it will appear here in real time.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fundHistory.map((item) => {
                    const isDeposit = (item.request_type || item.type) === 'DEPOSIT';
                    const amountVal = parseFloat(item.amount || 0);
                    const status = item.status || 'PENDING';
                    const dateFormatted = new Date(item.created_at || item.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={item.id}
                        className="p-3 sm:p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] transition flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isDeposit ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                            }`}
                          >
                            {isDeposit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div className="overflow-hidden">
                            <span className="text-xs font-bold text-[var(--text-main)] block truncate">
                              {isDeposit ? 'Deposit Request' : 'Withdrawal Request'}
                            </span>
                            <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)] font-mono block">
                              {dateFormatted}
                            </span>
                            {item.reference_note && (
                              <span className="inline-block mt-0.5 text-[9.5px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface-inset)] border border-[var(--border-color)] px-1.5 py-0.5 rounded max-w-[170px] sm:max-w-xs truncate">
                                {item.reference_note.split('\n')[0]}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Amount Box: Crisp Tabular Monospace Font & Status Badge */}
                        <div className="text-right flex-shrink-0">
                          <div
                            className={`font-mono font-black text-sm sm:text-base tracking-tight ${
                              isDeposit ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                          >
                            {isDeposit ? '+' : '-'}₹{amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="mt-0.5 flex justify-end">
                            <span
                              className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                status === 'APPROVED' || status === 'SUCCESS'
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                  : status === 'REJECTED'
                                  ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                                  : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              }`}
                            >
                              {status === 'PENDING' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              )}
                              {status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
