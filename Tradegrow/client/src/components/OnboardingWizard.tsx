import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as UserIcon, CheckCircle2, ShieldCheck, Building2, Wallet, TrendingUp, Zap, FileText,
  Sparkles, ArrowRight, ArrowLeft, RefreshCw, X, Check, Copy, Smartphone, UploadCloud
} from 'lucide-react';
import { User, Wallet as WalletType } from '../types';
import { Button, Badge } from './ui';
import { launchUpiApp, SupportedUpiApp } from '../utils/upiPayment';

interface OnboardingWizardProps {
  user: User;
  token: string;
  wallet: WalletType | null;
  isOpen: boolean;
  onClose: () => void;
  onRefreshWallet: () => void;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  user,
  token,
  wallet,
  isOpen,
  onClose,
  onRefreshWallet,
}) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(2);

  // KYC Method & State
  const [kycMethod, setKycMethod] = useState<'DIDIT' | 'MANUAL'>('DIDIT');
  const [diditUrl, setDiditUrl] = useState<string | null>(null);
  const [diditStatus, setDiditStatus] = useState<string | null>(null);
  const [isStartingDidit, setIsStartingDidit] = useState(false);
  const [isSyncingDidit, setIsSyncingDidit] = useState(false);
  const [kycApproved, setKycApproved] = useState(user.isKycCompleted || false);

  // Manual KYC Form
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panFile, setPanFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [submittingManualKyc, setSubmittingManualKyc] = useState(false);
  const [kycMsg, setKycMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bank Form
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState(user.fullName || user.username || '');
  const [bankIfsc, setBankIfsc] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);
  const [bankMsg, setBankMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fund Deposit
  const [depositAmount, setDepositAmount] = useState('25000');
  const [vpaCopied, setVpaCopied] = useState(false);
  const upiVpa = 'expertstokks@axl';

  // Check initial KYC and Bank status
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/v1/kyc/status', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          if (d.status === 'APPROVED' || d.isKycCompleted) {
            setKycApproved(true);
          }
          if (d.diditSessionUrl) setDiditUrl(d.diditSessionUrl);
          if (d.diditSessionStatus) setDiditStatus(d.diditSessionStatus);
          if (d.bankDetails) {
            if (d.bankDetails.bankName) setBankName(d.bankDetails.bankName);
            if (d.bankDetails.bankAccountNumber) {
              setBankAccountNumber(d.bankDetails.bankAccountNumber);
              setBankSaved(true);
            }
            if (d.bankDetails.bankAccountName) setBankAccountName(d.bankDetails.bankAccountName);
            if (d.bankDetails.bankIfsc) setBankIfsc(d.bankDetails.bankIfsc);
          }
        }
      })
      .catch(() => {});
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleStartDidit = async () => {
    setIsStartingDidit(true);
    setKycMsg(null);
    try {
      const res = await fetch('/api/v1/kyc/didit/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ callbackUrl: window.location.origin + '/profile/kyc' })
      });
      const data = await res.json();
      if (data.success && data.session?.sessionUrl) {
        setDiditUrl(data.session.sessionUrl);
        setDiditStatus(data.session.status || 'In Progress');

        const popup = window.open(data.session.sessionUrl, 'DiditKYC', 'width=520,height=780,scrollbars=yes,resizable=yes');
        if (!popup) {
          window.location.href = data.session.sessionUrl;
        }

        // Active background poller
        const poll = setInterval(async () => {
          try {
            const sRes = await fetch('/api/v1/kyc/didit/status', {
              headers: { Authorization: `Bearer ${token}` }
            });
            const sData = await sRes.json();
            if (sData.success) {
              setDiditStatus(sData.status);
              if (sData.status === 'Approved') {
                setKycApproved(true);
                clearInterval(poll);
              }
            }
          } catch (_) {}
        }, 4000);
        setTimeout(() => clearInterval(poll), 180000);
      } else {
        setKycMsg({ type: 'error', text: data.error?.message || 'Failed to start Didit verification' });
      }
    } catch (err: any) {
      setKycMsg({ type: 'error', text: err.message });
    } finally {
      setIsStartingDidit(false);
    }
  };

  const handleSyncDidit = async () => {
    setIsSyncingDidit(true);
    try {
      const res = await fetch('/api/v1/kyc/didit/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDiditStatus(data.status);
        if (data.status === 'Approved') {
          setKycApproved(true);
          setKycMsg({ type: 'success', text: 'KYC verified & approved!' });
        }
      }
    } catch (_) {}
    finally {
      setIsSyncingDidit(false);
    }
  };

  const handleManualKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingManualKyc(true);
    setKycMsg(null);
    const formData = new FormData();
    formData.append('panNumber', panNumber);
    formData.append('aadhaarNumber', aadhaarNumber);
    formData.append('bankAccountName', bankAccountName || user.username);
    formData.append('bankAccountNumber', bankAccountNumber || 'PENDING');
    formData.append('bankIfsc', bankIfsc || 'PENDING');
    formData.append('bankName', bankName || 'PENDING');
    if (panFile) { formData.append('panDoc', panFile); formData.append('panDocument', panFile); }
    if (aadhaarFile) { formData.append('aadhaarFrontDoc', aadhaarFile); formData.append('aadhaarFront', aadhaarFile); }

    try {
      const res = await fetch('/api/v1/kyc/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setKycMsg({ type: 'success', text: 'KYC submitted successfully! Proceeding to bank details.' });
        setTimeout(() => setCurrentStep(3), 1000);
      } else {
        setKycMsg({ type: 'error', text: data.error?.message || 'Submission failed' });
      }
    } catch (err: any) {
      setKycMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingManualKyc(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    setBankMsg(null);
    try {
      const res = await fetch('/api/v1/bank/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bankName, bankAccountNumber, bankAccountName, bankIfsc })
      });
      const data = await res.json();
      if (data.success) {
        setBankSaved(true);
        setBankMsg({ type: 'success', text: 'Bank details verified and linked!' });
        setTimeout(() => setCurrentStep(4), 800);
      } else {
        setBankMsg({ type: 'error', text: data.error?.message || 'Failed to save bank details' });
      }
    } catch (err: any) {
      setBankMsg({ type: 'error', text: err.message });
    } finally {
      setSavingBank(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      await fetch('/api/v1/onboarding/complete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (_) {}
    onClose();
    navigate('/option-chain');
  };

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(upiVpa);
    setVpaCopied(true);
    setTimeout(() => setVpaCopied(false), 2500);
  };

  const handleLaunchUpi = (app: SupportedUpiApp) => {
    const amt = parseFloat(depositAmount) || 25000;
    launchUpiApp(app, {
      upiId: upiVpa,
      merchantName: 'TradeGrow Brokerage',
      amount: amt,
      note: `Deposit ${user.username}`
    });
  };

  const STEPS_CONFIG = [
    { num: 1, label: 'Account Created', icon: <UserIcon className="w-4 h-4" /> },
    { num: 2, label: 'KYC Details', icon: <ShieldCheck className="w-4 h-4" /> },
    { num: 3, label: 'Bank Details', icon: <Building2 className="w-4 h-4" /> },
    { num: 4, label: 'Fund Add', icon: <Wallet className="w-4 h-4" /> },
    { num: 5, label: 'Trade', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with Stepper Progress */}
        <div className="p-5 sm:p-6 border-b border-[var(--border-color)] bg-[var(--bg-surface-inset)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-bold text-xs">TG</span>
              <span className="text-sm font-black tracking-tight">Trade<span className="text-[var(--primary)]">Grow</span> Onboarding</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stepper Strip */}
          <div className="grid grid-cols-5 gap-1 sm:gap-2">
            {STEPS_CONFIG.map((s) => {
              const isCompleted = s.num < currentStep || (s.num === 2 && kycApproved) || (s.num === 3 && bankSaved);
              const isCurrent = s.num === currentStep;
              return (
                <div
                  key={s.num}
                  className={`flex flex-col items-center text-center p-1.5 rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-bold'
                      : isCompleted
                      ? 'text-[var(--gain)]'
                      : 'text-[var(--text-muted)] opacity-60'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black mb-1 ${
                    isCompleted
                      ? 'bg-[var(--gain-light)] text-[var(--gain)]'
                      : isCurrent
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-tertiary)]'
                  }`}>
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </div>
                  <span className="text-[10px] hidden sm:block truncate w-full font-bold">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">

          {/* STEP 2: KYC DETAILS */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
                  Step 2: KYC Identity Verification
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Choose automated online verification via Didit or fill details manually.
                </p>
              </div>

              {kycMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${kycMsg.type === 'success' ? 'bg-[var(--gain-light)] text-[var(--gain)]' : 'bg-[var(--loss-light)] text-[var(--loss)]'}`}>
                  {kycMsg.text}
                </div>
              )}

              {/* Method Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setKycMethod('DIDIT')}
                  className={`p-4 rounded-2xl text-left transition border cursor-pointer ${
                    kycMethod === 'DIDIT' ? 'bg-[var(--bg-surface-inset)] border-[var(--primary)] shadow-sm' : 'border-[var(--border-color)] opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mb-2">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-[var(--text-main)]">Instant Online KYC</span>
                    <Badge variant="gain">60 Sec</Badge>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">Biometric OCR & 3D Face Match via Didit.me</p>
                </button>

                <button
                  type="button"
                  onClick={() => setKycMethod('MANUAL')}
                  className={`p-4 rounded-2xl text-left transition border cursor-pointer ${
                    kycMethod === 'MANUAL' ? 'bg-[var(--bg-surface-inset)] border-[var(--primary)] shadow-sm' : 'border-[var(--border-color)] opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface-inset)] text-[var(--text-main)] flex items-center justify-center mb-2">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-[var(--text-main)]">Manual Upload</span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">Enter PAN & upload identity files manually</p>
                </button>
              </div>

              {/* DIDIT INSTANT FLOW */}
              {kycMethod === 'DIDIT' && (
                <div className="p-5 rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-[var(--text-main)] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[var(--primary)]" /> Fast Online Identity Verification
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Automated Aadhaar/PAN scan & live selfie capture.</p>
                    </div>
                    {diditStatus && (
                      <Badge variant={diditStatus === 'Approved' ? 'gain' : diditStatus === 'Declined' ? 'loss' : 'warning'}>
                        {diditStatus}
                      </Badge>
                    )}
                  </div>

                  {kycApproved ? (
                    <div className="p-3 rounded-xl bg-[var(--gain-light)] text-[var(--gain)] text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> KYC Identity Approved! Click Next to configure Bank Details.
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                      <Button
                        size="md"
                        onClick={handleStartDidit}
                        disabled={isStartingDidit}
                        leftIcon={isStartingDidit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        className="w-full sm:w-auto"
                      >
                        {isStartingDidit ? 'Opening...' : diditUrl ? 'Resume Online KYC' : 'Start Instant Online KYC'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={handleSyncDidit}
                        disabled={isSyncingDidit}
                        leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncingDidit ? 'animate-spin' : ''}`} />}
                        className="w-full sm:w-auto"
                      >
                        Sync Status
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* MANUAL KYC FORM */}
              {kycMethod === 'MANUAL' && (
                <form onSubmit={handleManualKycSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">PAN Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ABCDE1234F"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        maxLength={10}
                        className="w-full bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-xl py-2 px-3 text-xs font-mono font-bold outline-none uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Aadhaar (12 Digits) *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 123456789012"
                        value={aadhaarNumber}
                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                        maxLength={12}
                        className="w-full bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-xl py-2 px-3 text-xs font-mono font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="bg-[var(--bg-surface-inset)] p-3 rounded-xl border border-[var(--border-color)]">
                      <span className="text-[10px] font-bold text-[var(--text-main)] block mb-1">PAN Card Photo</span>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => setPanFile(e.target.files?.[0] || null)} className="text-[10px]" />
                    </div>
                    <div className="bg-[var(--bg-surface-inset)] p-3 rounded-xl border border-[var(--border-color)]">
                      <span className="text-[10px] font-bold text-[var(--text-main)] block mb-1">Aadhaar Photo</span>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => setAadhaarFile(e.target.files?.[0] || null)} className="text-[10px]" />
                    </div>
                  </div>

                  <Button type="submit" disabled={submittingManualKyc} leftIcon={submittingManualKyc ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}>
                    {submittingManualKyc ? 'Submitting...' : 'Save & Continue'}
                  </Button>
                </form>
              )}

              <div className="flex justify-end pt-4 border-t border-[var(--border-color)] gap-2">
                <Button variant="primary" onClick={() => setCurrentStep(3)} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Next: Bank Details
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: BANK DETAILS */}
          {currentStep === 3 && (
            <form onSubmit={handleSaveBank} className="space-y-5">
              <div>
                <h2 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[var(--primary)]" />
                  Step 3: Link Bank Account
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Add your bank account for seamless 1-tap withdrawal settlements.
                </p>
              </div>

              {bankMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${bankMsg.type === 'success' ? 'bg-[var(--gain-light)] text-[var(--gain)]' : 'bg-[var(--loss-light)] text-[var(--loss)]'}`}>
                  {bankMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Bank Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Bank Ltd"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-xl py-2.5 px-3 text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Bank Account Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50100234567890"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-xl py-2.5 px-3 text-xs font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Account Holder Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="As per bank passbook"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    className="w-full bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-xl py-2.5 px-3 text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Bank IFSC Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC0000123"
                    value={bankIfsc}
                    onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                    maxLength={11}
                    className="w-full bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-xl py-2.5 px-3 text-xs font-mono font-bold outline-none uppercase"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-[var(--border-color)]">
                <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Back
                </Button>
                <Button type="submit" disabled={savingBank} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  {savingBank ? 'Saving...' : 'Save Bank & Continue'}
                </Button>
              </div>
            </form>
          )}

          {/* STEP 4: ADD FUNDS */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-[var(--primary)]" />
                  Step 4: Deposit Trading Funds
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Add initial trading capital via 1-tap mobile UPI or UPI ID.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase">Select Amount</span>
                  <span className="text-sm font-black text-[var(--gain)]">₹{Number(depositAmount).toLocaleString('en-IN')}</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {['5000', '10000', '25000', '50000', '100000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDepositAmount(amt)}
                      className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        depositAmount === amt
                          ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                          : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--primary)]/50'
                      }`}
                    >
                      ₹{Number(amt) >= 100000 ? `${Number(amt)/100000}L` : `${Number(amt)/1000}k`}
                    </button>
                  ))}
                </div>

                {/* 1-Tap Mobile UPI Buttons */}
                <div className="pt-2 border-t border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-2">1-Tap Direct UPI Apps</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleLaunchUpi('gpay')}
                      className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[#4285F4] flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-[#4285F4]" /> Google Pay
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLaunchUpi('phonepe')}
                      className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[#5f259f] flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-[#5f259f]" /> PhonePe
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLaunchUpi('paytm')}
                      className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[#00BAF2] flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-[#00BAF2]" /> Paytm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLaunchUpi('generic')}
                      className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--gain)] flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-[var(--gain)]" /> Any UPI
                    </button>
                  </div>
                </div>

                {/* Copy VPA */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                  <div>
                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold block">Payee UPI VPA</span>
                    <span className="text-xs font-mono font-bold text-[var(--text-main)]">{upiVpa}</span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={handleCopyVpa} leftIcon={vpaCopied ? <Check className="w-3.5 h-3.5 text-[var(--gain)]" /> : <Copy className="w-3.5 h-3.5" />}>
                    {vpaCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-[var(--border-color)]">
                <Button type="button" variant="secondary" onClick={() => setCurrentStep(3)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Back
                </Button>
                <Button type="button" onClick={() => setCurrentStep(5)} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Next: Start Trading
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: CELEBRATION & START TRADING */}
          {currentStep === 5 && (
            <div className="text-center py-6 space-y-6">
              <div className="w-20 h-20 rounded-full bg-[var(--gain-light)] text-[var(--gain)] flex items-center justify-center mx-auto animate-in zoom-in duration-300">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-[var(--text-main)] font-headline">Account Setup Complete!</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-md mx-auto leading-relaxed">
                  Your identity, linked bank account, and trading wallet are active. You can now execute live Indian F&O options and equities.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-left">
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase block">Account</span>
                  <span className="text-xs font-bold text-[var(--text-main)]">{user.username}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase block">KYC</span>
                  <span className="text-xs font-bold text-[var(--gain)]">Verified ✓</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase block">Bank</span>
                  <span className="text-xs font-bold text-[var(--text-main)]">{bankName || 'Linked ✓'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase block">Status</span>
                  <span className="text-xs font-bold text-[var(--gain)]">Active</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-color)] flex justify-center gap-3">
                <Button size="lg" variant="primary" onClick={handleCompleteOnboarding} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Open Option Chain & Start Trading
                </Button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
