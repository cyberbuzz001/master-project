import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  User as UserIcon, ShieldCheck, Wallet as WalletIcon, Lock, CheckCircle2, AlertTriangle,
  Clock, RefreshCw, Save, Building2, UploadCloud, KeyRound, HelpCircle, Shield,
  Sun, Moon, ArrowUpRight, ArrowDownLeft, QrCode, ExternalLink, Smartphone, MessageSquare, LogOut, Copy, Check,
  Zap, FileText, Sparkles, Volume2
} from 'lucide-react';
import { User, Wallet, isStaffUser } from '../types';
import { Card, CardHeader, CardTitle, Badge, Tabs, DataTable, DataTableColumn, Button, Dialog } from './ui';
import { PermissionsDashboard } from './admin/PermissionsDashboard';
import { SoundSettingsView } from './SoundSettingsView';
import { soundManager } from '../utils/soundManager';

type ProfileTab = 'account' | 'kyc' | 'bank' | 'security' | 'funds' | 'notifications' | 'support' | 'permissions' | 'appearance';

const TAB_META: { key: ProfileTab; label: string; icon: React.ReactNode; staffOnly?: boolean }[] = [
  { key: 'account', label: 'Account', icon: <UserIcon className="w-3.5 h-3.5" /> },
  { key: 'kyc', label: 'KYC', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { key: 'bank', label: 'Bank', icon: <Building2 className="w-3.5 h-3.5" /> },
  { key: 'security', label: 'Security', icon: <KeyRound className="w-3.5 h-3.5" /> },
  { key: 'funds', label: 'Funds', icon: <WalletIcon className="w-3.5 h-3.5" /> },
  { key: 'notifications', label: 'Sounds & Alerts', icon: <Volume2 className="w-3.5 h-3.5" /> },
  { key: 'support', label: 'Support', icon: <HelpCircle className="w-3.5 h-3.5" /> },
  { key: 'permissions', label: 'Permissions', icon: <Shield className="w-3.5 h-3.5" />, staffOnly: true },
  { key: 'appearance', label: 'Appearance', icon: <Sun className="w-3.5 h-3.5" /> },
];

interface ProfilePageProps {
  user: User;
  wallet: Wallet | null;
  token: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onLogout: () => void;
  onRefreshWallet: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, wallet, token, theme = 'dark', onToggleTheme, onLogout, onRefreshWallet }) => {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  const isStaff = isStaffUser(user.role);
  const validTabs = TAB_META.filter((t) => !t.staffOnly || isStaff).map((t) => t.key);
  const activeTab: ProfileTab = (validTabs as string[]).includes(tab || '') ? (tab as ProfileTab) : 'account';

  useEffect(() => {
    if (tab !== activeTab) navigate(`/profile/${activeTab}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const fetchWithAuth = (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  };

  // ============================================================
  // ACCOUNT (personal details) STATE
  // ============================================================
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const fetchProfileDetails = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/user/profile');
      const data = await res.json();
      if (data.success && data.profile) {
        setFullName(data.profile.fullName || '');
        setPhoneNumber(data.profile.phoneNumber || '');
        setCity(data.profile.city || '');
        setAddress(data.profile.address || '');
        setDateOfBirth(data.profile.dateOfBirth || '');
      }
    } catch (_) {}
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetchWithAuth('/api/v1/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phoneNumber, city, address, dateOfBirth }),
      });
      const data = await res.json();
      setProfileMsg(data.success
        ? { type: 'success', text: data.message || 'Profile details updated successfully!' }
        : { type: 'error', text: data.error?.message || 'Failed to update profile' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setSavingProfile(false);
    }
  };


  // ============================================================
  // KYC STATE
  // ============================================================
  const [kycStatus, setKycStatus] = useState('NOT_STARTED');
  const [kycMethod, setKycMethod] = useState<'DIDIT' | 'MANUAL'>('DIDIT');
  const [diditSessionUrl, setDiditSessionUrl] = useState<string | null>(null);
  const [diditSessionStatus, setDiditSessionStatus] = useState<string | null>(null);
  const [startingDidit, setStartingDidit] = useState(false);
  const [syncingDidit, setSyncingDidit] = useState(false);
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [panFile, setPanFile] = useState<File | null>(null);
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState<File | null>(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState<File | null>(null);
  const [bankProofFile, setBankProofFile] = useState<File | null>(null);
  const [kycMessage, setKycMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittingKyc, setSubmittingKyc] = useState(false);

  // Bank edit state
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankMsg, setBankMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchKycStatus = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/kyc/status');
      const data = await res.json();
      if (data.success) {
        setKycStatus(data.status || 'NOT_STARTED');
        if (data.verificationMethod) {
          setKycMethod(data.verificationMethod === 'DIDIT' ? 'DIDIT' : 'MANUAL');
        }
        if (data.diditSessionUrl) setDiditSessionUrl(data.diditSessionUrl);
        if (data.diditSessionStatus) setDiditSessionStatus(data.diditSessionStatus);
        if (data.bankDetails) {
          setBankName(data.bankDetails.bankName || '');
          setBankAccountNumber(data.bankDetails.bankAccountNumber || '');
          setBankAccountName(data.bankDetails.bankAccountName || '');
          setBankIfsc(data.bankDetails.bankIfsc || '');
        } else if (data.application) {
          setPanNumber(data.application.pan_number || '');
          setAadhaarNumber(data.application.aadhaar_number || '');
          setBankAccountName(data.application.bank_account_name || '');
          setBankAccountNumber(data.application.bank_account_number || '');
          setBankIfsc(data.application.bank_ifsc || '');
          setBankName(data.application.bank_name || '');
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchProfileDetails();
    fetchKycStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleStartDiditKyc = async () => {
    setStartingDidit(true);
    setKycMessage(null);
    try {
      const res = await fetchWithAuth('/api/v1/kyc/didit/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackUrl: window.location.origin + '/profile/kyc' })
      });
      const data = await res.json();
      if (data.success && data.session?.sessionUrl) {
        setDiditSessionUrl(data.session.sessionUrl);
        setDiditSessionStatus(data.session.status || 'In Progress');
        
        // Open verification portal in window
        const popup = window.open(data.session.sessionUrl, 'DiditKYC', 'width=520,height=780,scrollbars=yes,resizable=yes');
        if (!popup) {
          window.location.href = data.session.sessionUrl;
        } else {
          setKycMessage({ type: 'success', text: 'Verification window opened! Complete ID capture and selfie liveness on screen.' });
        }

        // Active background poller to auto-detect approval
        const pollInterval = setInterval(async () => {
          try {
            const sRes = await fetchWithAuth('/api/v1/kyc/didit/status');
            const sData = await sRes.json();
            if (sData.success) {
              setDiditSessionStatus(sData.status);
              if (sData.status === 'Approved') {
                setKycStatus('APPROVED');
                setKycMessage({ type: 'success', text: '🎉 Instant KYC verification approved successfully! You are now verified to trade.' });
                clearInterval(pollInterval);
                fetchKycStatus();
              }
            }
          } catch (_) {}
        }, 4000);
        setTimeout(() => clearInterval(pollInterval), 180000); // 3 mins timeout
      } else {
        setKycMessage({ type: 'error', text: data.error?.message || 'Failed to initialize Didit verification session' });
      }
    } catch (err: any) {
      setKycMessage({ type: 'error', text: err.message || 'Network error while initializing Didit verification' });
    } finally {
      setStartingDidit(false);
    }
  };

  const handleSyncDiditStatus = async () => {
    setSyncingDidit(true);
    setKycMessage(null);
    try {
      const res = await fetchWithAuth('/api/v1/kyc/didit/status');
      const data = await res.json();
      if (data.success) {
        setDiditSessionStatus(data.status);
        if (data.status === 'Approved') {
          setKycStatus('APPROVED');
          setKycMessage({ type: 'success', text: '🎉 KYC is verified & approved!' });
        } else {
          setKycMessage({ type: 'success', text: `Verification status: ${data.status || 'In Progress'}` });
        }
        fetchKycStatus();
      } else {
        setKycMessage({ type: 'error', text: data.error?.message || 'Could not sync status' });
      }
    } catch (err: any) {
      setKycMessage({ type: 'error', text: err.message });
    } finally {
      setSyncingDidit(false);
    }
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    setBankMsg(null);
    try {
      const res = await fetchWithAuth('/api/v1/bank/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankName, bankAccountNumber, bankAccountName, bankIfsc })
      });
      const data = await res.json();
      if (data.success) {
        setBankMsg({ type: 'success', text: 'Bank details saved successfully!' });
        setIsEditingBank(false);
        fetchKycStatus();
      } else {
        setBankMsg({ type: 'error', text: data.error?.message || 'Failed to save bank details' });
      }
    } catch (err: any) {
      setBankMsg({ type: 'error', text: err.message });
    } finally {
      setSavingBank(false);
    }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingKyc(true);
    setKycMessage(null);
    const formData = new FormData();
    formData.append('panNumber', panNumber);
    formData.append('aadhaarNumber', aadhaarNumber);
    formData.append('bankAccountName', bankAccountName);
    formData.append('bankAccountNumber', bankAccountNumber);
    formData.append('bankIfsc', bankIfsc);
    formData.append('bankName', bankName);
    if (panFile) { formData.append('panDoc', panFile); formData.append('panDocument', panFile); }
    if (aadhaarFrontFile) { formData.append('aadhaarFrontDoc', aadhaarFrontFile); formData.append('aadhaarFront', aadhaarFrontFile); }
    if (aadhaarBackFile) { formData.append('aadhaarBackDoc', aadhaarBackFile); formData.append('aadhaarBack', aadhaarBackFile); }
    if (bankProofFile) { formData.append('bankProofDoc', bankProofFile); formData.append('bankProof', bankProofFile); }

    try {
      const res = await fetchWithAuth('/api/v1/kyc/submit', { method: 'POST', body: formData });
      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { success: res.ok, error: { message: text || `Server responded with status ${res.status}` } };
      }
      if (data.success) {
        setKycMessage({ type: 'success', text: data.message || 'KYC application submitted successfully!' });
        setKycStatus('SUBMITTED');
        fetchKycStatus();
      } else {
        setKycMessage({ type: 'error', text: data.error?.message || data.message || 'Failed to submit KYC application' });
      }
    } catch (err: any) {
      setKycMessage({ type: 'error', text: err.message || 'Network error while submitting KYC' });
    } finally {
      setSubmittingKyc(false);
    }
  };

  const isKycVerified = kycStatus === 'APPROVED' || user.isKycCompleted;

  // ============================================================
  // SECURITY STATE
  // ============================================================
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMsg, setSecurityMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setSecurityMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setSavingPassword(true);
    setSecurityMsg(null);
    try {
      const res = await fetchWithAuth('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setSecurityMsg({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      } else {
        setSecurityMsg({ type: 'error', text: data.error?.message || 'Failed to change password' });
      }
    } catch (err: any) {
      setSecurityMsg({ type: 'error', text: err.message });
    } finally {
      setSavingPassword(false);
    }
  };

  // ============================================================
  // FUNDS (deposit/withdrawal + Merchant UPI / Bank) STATE
  // ============================================================
  const [requestType, setRequestType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [fundAmountInput, setFundAmountInput] = useState('50000');
  const fundAmount = parseFloat(fundAmountInput) || 0;
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [referenceNote, setReferenceNote] = useState('');
  const [fundMessage, setFundMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fundRequests, setFundRequests] = useState<any[]>([]);
  const [submittingFundReq, setSubmittingFundReq] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<{
    upiId: string;
    merchantName: string;
    qrImageUrl: string;
    quickPayLinks: { amount: number; url: string; label?: string }[];
    bankDetails?: {
      bankName: string;
      accountName: string;
      accountNumber: string;
      ifscCode: string;
      branch: string;
    };
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

  const availableBalance = wallet?.buyingPower ?? wallet?.cashBalance ?? 0;

  const fetchFundRequests = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/funds/my-requests');
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) setFundRequests(data.requests);
    } catch (_) {}
  };

  const fetchPaymentConfig = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/funds/payment-settings');
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
              ],
          bankDetails: data.settings.bankDetails
        });
      }
    } catch (_) {}
  };

  const [savings, setSavings] = useState<{
    totalSaved: number;
    brokerageSaved: number;
    statutorySaved: number;
    filledOrdersCount: number;
    closedTradesCount: number;
    tradeGrowFee: number;
  } | null>(null);

  const fetchSavingsSummary = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/portfolio/savings-summary');
      const data = await res.json();
      if (data.success && data.savings) {
        setSavings(data.savings);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === 'funds') {
      fetchFundRequests();
      fetchPaymentConfig();
      fetchSavingsSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSubmitFundRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFundMessage(null);
    if (fundAmount <= 0) {
      setFundMessage({ type: 'error', text: 'Please enter a valid amount greater than ₹0' });
      return;
    }
    if (requestType === 'WITHDRAWAL' && fundAmount > availableBalance) {
      setFundMessage({ type: 'error', text: `Insufficient available funds. Maximum withdrawable: ₹${availableBalance.toLocaleString('en-IN')}` });
      return;
    }
    setSubmittingFundReq(true);
    try {
      const res = await fetchWithAuth('/api/v1/funds/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType, amount: fundAmount, paymentMethod, referenceNote: referenceNote.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        soundManager.playSound('payment_success');
        setFundMessage({ type: 'success', text: data.message || `${requestType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} request submitted for admin approval!` });
        setReferenceNote('');
        fetchFundRequests();
        onRefreshWallet();
      } else {
        soundManager.playSound('payment_failed');
        setFundMessage({ type: 'error', text: data.error?.message || data.message || 'Failed to submit fund request' });
      }
    } catch (err: any) {
      soundManager.playSound('payment_failed');
      setFundMessage({ type: 'error', text: err.message });
    } finally {
      setSubmittingFundReq(false);
    }
  };

  const fundColumns: DataTableColumn<any>[] = [
    { key: 'type', header: 'Type', mobilePrimary: true, render: (r) => <Badge variant={r.request_type === 'DEPOSIT' ? 'gain' : 'loss'}>{r.request_type}</Badge> },
    { key: 'amount', header: 'Amount', render: (r) => <span className="num-font font-bold">₹{parseFloat(r.amount).toLocaleString('en-IN')}</span> },
    { key: 'method', header: 'Method', mobileHidden: true, render: (r) => <span className="text-xs">{r.payment_method}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'APPROVED' ? 'gain' : r.status === 'REJECTED' ? 'loss' : 'warning'}>{r.status}</Badge> },
    { key: 'date', header: 'Date', mobileHidden: true, render: (r) => <span className="text-[11px] text-[var(--text-muted)] num-font">{new Date(r.created_at).toLocaleString('en-IN')}</span> },
  ];

  // ============================================================
  // SUPPORT STATE
  // ============================================================
  const [supportCategory, setSupportCategory] = useState('TRADING');
  const [supportPriority, setSupportPriority] = useState('MEDIUM');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDesc, setSupportDesc] = useState('');
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [submittingSupport, setSubmittingSupport] = useState(false);
  const [supportMsg, setSupportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSupportTickets = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/support/tickets');
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) setSupportTickets(data.tickets);
    } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === 'support') fetchSupportTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSubmitSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportMsg(null);
    setSubmittingSupport(true);
    try {
      const res = await fetchWithAuth('/api/v1/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: supportCategory, priority: supportPriority, subject: supportSubject, description: supportDesc }),
      });
      const data = await res.json();
      if (data.success) {
        setSupportMsg({ type: 'success', text: data.message || 'Support ticket submitted successfully!' });
        setSupportSubject(''); setSupportDesc('');
        fetchSupportTickets();
      } else {
        setSupportMsg({ type: 'error', text: data.error?.message || 'Failed to submit ticket' });
      }
    } catch (err: any) {
      setSupportMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingSupport(false);
    }
  };

  const ticketColumns: DataTableColumn<any>[] = [
    { key: 'subject', header: 'Subject', mobilePrimary: true, render: (t) => <span className="font-bold">{t.subject}</span> },
    { key: 'category', header: 'Category', mobileHidden: true, render: (t) => <Badge variant="neutral">{t.category}</Badge> },
    { key: 'status', header: 'Status', render: (t) => <Badge variant={t.status === 'RESOLVED' ? 'gain' : 'info'}>{t.status}</Badge> },
    {
      key: 'response', header: 'Team Response',
      // admin_notes was written by the admin's respond-to-ticket flow but was never
      // surfaced here — a customer had no way to ever see a reply, even once one existed.
      render: (t) => t.admin_notes ? (
        <span className="text-[var(--text-main)]">{t.admin_notes}</span>
      ) : (
        <span className="text-[var(--text-tertiary)] italic">Awaiting response</span>
      ),
    },
    { key: 'date', header: 'Opened', mobileHidden: true, render: (t) => <span className="text-[11px] text-[var(--text-muted)] num-font">{new Date(t.created_at).toLocaleString()}</span> },
  ];

  // ============================================================
  // RENDER
  // ============================================================
  const InfoMessage = ({ msg }: { msg: { type: 'success' | 'error'; text: string } | null }) => msg ? (
    <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 ${msg.type === 'success' ? 'bg-[var(--gain-light)] text-[var(--gain)] border border-[var(--gain)]/30' : 'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]/30'}`}>
      {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      <span>{msg.text}</span>
    </div>
  ) : null;

  const inputClass = 'w-full bg-[var(--bg-surface-inset)] border border-[var(--border-color)] focus:border-[var(--primary)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-main)] outline-none transition-colors';
  const labelClass = 'text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5';

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
      {/* PROFILE HEADER */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[var(--info)] flex items-center justify-center text-white text-xl font-black shadow-md flex-shrink-0">
              {(fullName || user.username || 'T').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-[var(--text-main)]">{fullName || user.username}</h2>
                <Badge variant={isKycVerified ? 'gain' : 'warning'} dot>{isKycVerified ? 'KYC Verified' : 'KYC Pending'}</Badge>
                {isStaff && <Badge variant="primary">{user.role}</Badge>}
              </div>
              <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
                {user.email} <span className="mx-1.5 opacity-50">•</span> Client ID: TG-{user.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <div className="bg-[var(--bg-surface-inset)] border border-[var(--border-color)] px-4 py-2.5 rounded-xl">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide block">Available Margin</span>
            <span className="text-base font-black text-[var(--gain)] num-font">₹{(wallet?.cashBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </Card>

      <Tabs
        ariaLabel="Profile section"
        value={activeTab}
        onChange={(v) => navigate(`/profile/${v}`)}
        items={TAB_META.filter((t) => !t.staffOnly || isStaff).map((t) => ({ value: t.key, label: t.label, icon: t.icon }))}
      />

      {/* ACCOUNT TAB */}
      {activeTab === 'account' && (
        <Card className="space-y-5">
          <CardHeader className="pb-4 border-b border-[var(--border-color)] mb-0">
            <div>
              <CardTitle>Personal & Account Information</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Keep your contact details updated for official trading communications.</p>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelClass}>Client / Account ID</label><input type="text" disabled value={user.id} className={`${inputClass} opacity-60 cursor-not-allowed font-mono`} /></div>
            <div><label className={labelClass}>Username</label><input type="text" disabled value={user.username} className={`${inputClass} opacity-60 cursor-not-allowed font-mono`} /></div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelClass}>Full Legal Name</label><input type="text" required placeholder="e.g. Nikhil Sharma" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Phone Number</label><input type="tel" placeholder="e.g. +91 9876543210" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>City / District</label><input type="text" placeholder="e.g. Mumbai, Maharashtra" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Date of Birth</label><input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} /></div>
              <div className="md:col-span-2"><label className={labelClass}>Complete Address</label><textarea rows={3} placeholder="Street address, Flat/Building no., Landmark, Pincode" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} /></div>
            </div>
            <InfoMessage msg={profileMsg} />
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile} leftIcon={savingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>Save Profile Changes</Button>
            </div>
          </form>

          {/* Sign out lives here now that the avatar in AppShell navigates
              straight to this page instead of opening a dropdown that used to
              hold it. Kept visually separated from the profile form above and
              styled as destructive, per the destructive-nav-separation rule —
              it should never sit adjacent to routine "save my details" actions. */}
          <div className="pt-4 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-xs font-bold text-[var(--text-main)]">Sign out</h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Ends this session on this device. Your positions, orders and funds are unaffected.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                leftIcon={<LogOut className="w-4 h-4" />}
                onClick={() => setIsLogoutModalOpen(true)}
              >
                Sign out
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* KYC TAB */}
      {activeTab === 'kyc' && (
        <Card className="space-y-6">
          <CardHeader className="pb-4 border-b border-[var(--border-color)] mb-0 flex-wrap gap-2">
            <div>
              <CardTitle>KYC & Regulatory Compliance</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Verify your account using Instant Online Verification or Manual Document Upload.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={kycStatus === 'APPROVED' ? 'gain' : kycStatus === 'SUBMITTED' || kycStatus === 'UNDER_REVIEW' ? 'warning' : 'loss'}>
                {kycStatus === 'APPROVED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />} {kycStatus}
              </Badge>
            </div>
          </CardHeader>

          <InfoMessage msg={kycMessage} />

          {/* Visual 4-Step KYC Progress Stepper */}
          <div className="p-4 rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
              <span>KYC Verification Steps</span>
              <span className="text-[var(--primary)] font-mono">
                {kycStatus === 'APPROVED' ? '4 / 4 Complete (100%)' : kycStatus === 'SUBMITTED' ? '3 / 4 In Review (75%)' : panNumber ? '2 / 4 In Progress (50%)' : '1 / 4 Started (25%)'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { step: '1', title: 'PAN Verification', done: Boolean(panNumber || kycStatus === 'APPROVED') },
                { step: '2', title: 'Aadhaar DigiLocker', done: Boolean(aadhaarNumber || kycStatus === 'APPROVED') },
                { step: '3', title: 'Bank Account Linked', done: Boolean(bankAccountNumber || kycStatus === 'APPROVED') },
                { step: '4', title: 'Compliance Approval', done: kycStatus === 'APPROVED' },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                    s.done
                      ? 'bg-[var(--gain-light)] border-[var(--gain)]/30 text-[var(--gain)]'
                      : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                      s.done ? 'bg-[var(--gain)] text-white' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'
                    }`}
                  >
                    {s.done ? <Check className="w-3 h-3" /> : s.step}
                  </div>
                  <span className="text-[11px] font-bold truncate">{s.title}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1.5 rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
            <button
              type="button"
              onClick={() => setKycMethod('DIDIT')}
              className={`p-3.5 rounded-xl text-left transition-all cursor-pointer border flex items-start gap-3 ${
                kycMethod === 'DIDIT'
                  ? 'bg-[var(--bg-surface)] border-[var(--primary)] shadow-sm'
                  : 'border-transparent hover:bg-[var(--bg-surface)]/50 text-[var(--text-muted)]'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                kycMethod === 'DIDIT' ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'bg-[var(--bg-body)] text-[var(--text-tertiary)]'
              }`}>
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[var(--text-main)]">Instant Online KYC</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-[var(--primary)]/10 text-[var(--primary)] uppercase">Automated</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                  60-second verification via Didit.me biometric OCR & Face Liveness.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setKycMethod('MANUAL')}
              className={`p-3.5 rounded-xl text-left transition-all cursor-pointer border flex items-start gap-3 ${
                kycMethod === 'MANUAL'
                  ? 'bg-[var(--bg-surface)] border-[var(--primary)] shadow-sm'
                  : 'border-transparent hover:bg-[var(--bg-surface)]/50 text-[var(--text-muted)]'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                kycMethod === 'MANUAL' ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'bg-[var(--bg-body)] text-[var(--text-tertiary)]'
              }`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[var(--text-main)]">Manual Document Upload</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-[var(--bg-body)] text-[var(--text-tertiary)] uppercase">Standard</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                  Fill details manually & upload PAN, Aadhaar, and Bank proof files.
                </p>
              </div>
            </button>
          </div>

          {/* METHOD 1: DIDIT.ME ONLINE VERIFICATION */}
          {kycMethod === 'DIDIT' && (
            <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-black text-[var(--text-main)] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                    Automated Biometric Identity Verification
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xl leading-relaxed">
                    Verify government ID cards (Aadhaar / PAN / Passport / DL) and facial liveness in real-time. No manual form typing required.
                  </p>
                </div>
                {diditSessionStatus && (
                  <Badge variant={diditSessionStatus === 'Approved' ? 'gain' : diditSessionStatus === 'Declined' ? 'loss' : 'warning'}>
                    Session: {diditSessionStatus}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase mb-1">Step 1</div>
                  <div className="text-xs font-bold text-[var(--text-main)]">ID Card Scan</div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Automated OCR data extraction from Aadhaar/PAN</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase mb-1">Step 2</div>
                  <div className="text-xs font-bold text-[var(--text-main)]">3D Face Liveness</div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Instant biometric selfie match to prevent fraud</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase mb-1">Step 3</div>
                  <div className="text-xs font-bold text-[var(--text-main)]">Instant Approval</div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Account verified and trading activated immediately</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-color)] flex-wrap">
                {kycStatus === 'APPROVED' ? (
                  <div className="p-3 rounded-xl bg-[var(--gain-light)] text-[var(--gain)] text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Your account KYC is fully verified and active.
                  </div>
                ) : (
                  <>
                    <Button
                      size="lg"
                      onClick={handleStartDiditKyc}
                      disabled={startingDidit}
                      leftIcon={startingDidit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    >
                      {startingDidit ? 'Launching Verification…' : diditSessionUrl ? 'Continue Instant Verification' : 'Start Instant Online KYC'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={handleSyncDiditStatus}
                      disabled={syncingDidit}
                      leftIcon={syncingDidit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    >
                      {syncingDidit ? 'Checking…' : 'Sync Status'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* METHOD 2: MANUAL DOCUMENT UPLOAD */}
          {kycMethod === 'MANUAL' && (
            <form onSubmit={handleKycSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelClass}>PAN Card Number *</label><input type="text" required placeholder="e.g. ABCDE1234F" value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} maxLength={10} className={`${inputClass} uppercase font-mono`} /></div>
                <div><label className={labelClass}>Aadhaar Number (12 digits) *</label><input type="text" required placeholder="e.g. 123456789012" value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))} maxLength={12} className={`${inputClass} font-mono`} /></div>
                <div><label className={labelClass}>Bank Name *</label><input type="text" required placeholder="e.g. HDFC Bank Ltd" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Bank Account Number *</label><input type="text" required placeholder="e.g. 50100234567890" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={`${inputClass} font-mono`} /></div>
                <div><label className={labelClass}>Account Holder Name *</label><input type="text" required placeholder="As per bank passbook" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Bank IFSC Code *</label><input type="text" required placeholder="e.g. HDFC0000123" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} maxLength={11} className={`${inputClass} uppercase font-mono`} /></div>
              </div>

              <div className="pt-4 border-t border-[var(--border-color)] space-y-3">
                <h4 className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wide">Verification Documents (PDF / JPG / PNG)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'PAN Card Photo', file: panFile, set: setPanFile },
                    { label: 'Aadhaar Front', file: aadhaarFrontFile, set: setAadhaarFrontFile },
                    { label: 'Aadhaar Back', file: aadhaarBackFile, set: setAadhaarBackFile },
                    { label: 'Cancelled Cheque', file: bankProofFile, set: setBankProofFile },
                  ].map((d) => (
                    <div key={d.label} className="bg-[var(--bg-surface-inset)] p-3.5 rounded-xl border border-[var(--border-color)]">
                      <span className="text-[11px] font-bold text-[var(--text-main)] block mb-1">{d.label}</span>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => d.set(e.target.files?.[0] || null)} className="text-[10px] text-[var(--text-muted)] file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-[var(--primary-light)] file:text-[var(--primary)]" />
                      {d.file && <span className="text-[10px] text-[var(--gain)] font-bold mt-1 block">✓ {d.file.name}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={submittingKyc || kycStatus === 'APPROVED'} leftIcon={submittingKyc ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}>
                  {kycStatus === 'APPROVED' ? 'KYC Already Approved' : submittingKyc ? 'Submitting KYC...' : 'Submit KYC for Verification'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* BANK TAB */}
      {activeTab === 'bank' && (
        <Card className="space-y-5">
          <CardHeader className="pb-4 border-b border-[var(--border-color)] mb-0 flex-wrap gap-2">
            <div>
              <CardTitle>Verified Bank Account</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Trading proceeds and withdrawal settlements route through this verified account.</p>
            </div>
            <Button
              size="sm"
              variant={isEditingBank ? 'secondary' : 'primary'}
              onClick={() => { setIsEditingBank(!isEditingBank); setBankMsg(null); }}
            >
              {isEditingBank ? 'Cancel Edit' : 'Edit Bank Details'}
            </Button>
          </CardHeader>

          <InfoMessage msg={bankMsg} />

          {isEditingBank ? (
            <form onSubmit={handleSaveBankDetails} className="p-4 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-4">
              <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wide">Update Bank Account Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Bank Name *</label>
                  <input type="text" required placeholder="e.g. HDFC Bank Ltd" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Bank Account Number *</label>
                  <input type="text" required placeholder="e.g. 50100234567890" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={`${inputClass} font-mono`} />
                </div>
                <div>
                  <label className={labelClass}>Account Holder Name *</label>
                  <input type="text" required placeholder="As per bank passbook" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Bank IFSC Code *</label>
                  <input type="text" required placeholder="e.g. HDFC0000123" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} maxLength={11} className={`${inputClass} uppercase font-mono`} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <Button type="button" variant="secondary" onClick={() => setIsEditingBank(false)}>Cancel</Button>
                <Button type="submit" disabled={savingBank} leftIcon={savingBank ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>
                  {savingBank ? 'Saving...' : 'Save Bank Details'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-[var(--text-main)]">{bankName || 'No Bank Linked Yet'}</span>
                  {bankName && <Badge variant="gain">Primary</Badge>}
                </div>
                <div className="space-y-1 text-xs text-[var(--text-muted)] font-mono">
                  <p>A/C: <span className="text-[var(--text-main)] font-bold">{bankAccountNumber ? `•••• •••• ${bankAccountNumber.slice(-4)}` : 'Not Set'}</span></p>
                  <p>IFSC: <span className="text-[var(--text-main)] font-bold">{bankIfsc || 'Not Set'}</span></p>
                  <p>Name: <span className="text-[var(--text-muted)]">{bankAccountName || fullName || user.username}</span></p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-[var(--text-main)]">Instant Withdrawals</span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Settlements are directly transferred to this bank account upon withdrawal request.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setIsEditingBank(true)} className="mt-3 w-fit">
                  Update Account
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* SECURITY TAB */}
      {activeTab === 'security' && (
        <Card className="space-y-5">
          <CardHeader className="pb-4 border-b border-[var(--border-color)] mb-0">
            <div>
              <CardTitle>Security &amp; Authentication</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage your password, active sessions, and multi-factor security.</p>
            </div>
          </CardHeader>

          {/* Active Session & Device Audit Panel */}
          <div className="p-4 rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[var(--primary)]" />
                <span className="text-xs font-black text-[var(--text-main)]">Active Device Session</span>
              </div>
              <Badge variant="gain" dot>CURRENT SESSION</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Browser &amp; Platform</span>
                <span className="font-bold text-[var(--text-main)] truncate block mt-0.5">
                  {typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows') ? 'Windows • Desktop App' : 'Secure Web Client'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Token Protocol</span>
                <span className="font-mono font-bold text-[var(--gain)] block mt-0.5">HS256 Encrypted</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Auto Re-Auth</span>
                <span className="font-bold text-[var(--text-main)] block mt-0.5">Active (Silent Refresh)</span>
              </div>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
            <div><label className={labelClass}>Current Password</label><input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>New Password</label><input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Confirm New Password</label><input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} /></div>
            <InfoMessage msg={securityMsg} />
            <Button type="submit" disabled={savingPassword} leftIcon={savingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}>Update Password</Button>
          </form>
          <div className="pt-4 border-t border-[var(--border-color)]">
            <h4 className="font-bold text-xs text-[var(--text-main)] mb-1">Session Security</h4>
            <p className="text-xs text-[var(--text-muted)]">Your session is secured using encrypted JWT tokens with automatic silent refresh.</p>
          </div>
        </Card>
      )}

      {/* FUNDS TAB */}
      {activeTab === 'funds' && (() => {
        const totalCapital = (wallet?.cashBalance ?? 0) + (wallet?.usedMargin ?? 0);
        const usedMargin = wallet?.usedMargin ?? 0;
        const availableTrade = wallet?.cashBalance ?? 0;
        const availableWithdraw = Math.max(0, availableTrade);
        const marginUtilPct = totalCapital > 0 ? (usedMargin / totalCapital) * 100 : 0;

        return (
          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Trading Funds &amp; Margin Overview</CardTitle>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time ledger balance, buying power, and margin exposure.</p>
                </div>
                <Badge variant={marginUtilPct > 85 ? 'loss' : marginUtilPct > 60 ? 'warning' : 'gain'}>
                  {marginUtilPct.toFixed(0)}% Margin Used
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 num-font">
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Total Net Balance</span>
                  <span className="text-base sm:text-lg font-black text-[var(--text-main)]">₹{totalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Available to Trade</span>
                  <span className="text-base sm:text-lg font-black text-[var(--gain)]">₹{availableTrade.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Available to Withdraw</span>
                  <span className="text-base sm:text-lg font-black text-indigo-500">₹{availableWithdraw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Blocked / Used Margin</span>
                  <span className="text-base sm:text-lg font-black text-[var(--warning)]">₹{usedMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Margin Utilization Meter */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-[var(--text-muted)]">Margin Utilization</span>
                  <span className={marginUtilPct > 85 ? 'text-[var(--loss)] font-black' : marginUtilPct > 60 ? 'text-[var(--warning)]' : 'text-[var(--gain)]'}>
                    {marginUtilPct.toFixed(1)}% ({marginUtilPct > 85 ? 'Critical Warning' : marginUtilPct > 60 ? 'Moderate' : 'Safe'})
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[var(--bg-surface-inset)] border border-[var(--border-color)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      marginUtilPct > 85
                        ? 'bg-[var(--loss)]'
                        : marginUtilPct > 60
                        ? 'bg-[var(--warning)]'
                        : 'bg-[var(--gain)]'
                    }`}
                    style={{ width: `${Math.min(marginUtilPct, 100)}%` }}
                  />
                </div>
                {marginUtilPct > 85 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--loss)] font-bold mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Warning: Margin utilization is above 85%. Deposit funds to protect open positions from auto risk liquidation.</span>
                  </div>
                )}
              </div>
            </Card>

            {/* ZERO BROKERAGE & PLATFORM CHARGES SAVED CARD */}
            <Card className="p-4 sm:p-5 relative overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-[var(--bg-surface)] via-emerald-950/10 to-[var(--bg-surface)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-[var(--text-main)]">Zero Brokerage &amp; Platform Savings</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        100% Free
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Estimated brokerage &amp; statutory taxes you kept in your pocket compared to standard retail brokers (₹20/order + STT + turnover taxes).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/portfolio/journal')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
                >
                  View in Journal <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 font-mono">
                {/* Total Money Saved */}
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1 font-sans">
                    Total Money Saved
                  </span>
                  <span className="text-lg sm:text-xl font-black text-emerald-400">
                    ₹{(savings?.totalSaved ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-400/70 block mt-1 font-sans">
                    ₹0 vs traditional broker costs
                  </span>
                </div>

                {/* Brokerage Saved */}
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1 font-sans">
                    Brokerage Saved
                  </span>
                  <span className="text-base sm:text-lg font-black text-[var(--text-main)]">
                    ₹{(savings?.brokerageSaved ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-1 font-sans">
                    Flat ₹20/order saved
                  </span>
                </div>

                {/* Taxes & Charges Saved */}
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1 font-sans">
                    Taxes &amp; Fees Saved
                  </span>
                  <span className="text-base sm:text-lg font-black text-[var(--text-main)]">
                    ₹{(savings?.statutorySaved ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-1 font-sans">
                    STT, GST &amp; Exchange charges
                  </span>
                </div>

                {/* TradeGrow Platform Fee */}
                <div className="p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1 font-sans">
                    TradeGrow Cost
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-400">
                    ₹0.00
                  </span>
                  <span className="text-[10px] text-emerald-400/80 block mt-1 font-sans font-bold">
                    Zero Brokerage Always
                  </span>
                </div>
              </div>
            </Card>

            <Card className="space-y-4">
              <CardHeader className="mb-0">
                <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wide">Fund Deposit & Withdrawal Request</h4>
                <Badge variant="info">Requires Admin Approval</Badge>
              </CardHeader>
            <form onSubmit={handleSubmitFundRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setRequestType('DEPOSIT')} className={`py-2 rounded-xl font-black text-xs transition border cursor-pointer ${requestType === 'DEPOSIT' ? 'bg-[var(--gain)] border-[var(--gain)] text-white' : 'bg-[var(--bg-surface-inset)] border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                  <ArrowDownLeft className="w-3.5 h-3.5 inline mr-1" /> Request Deposit
                </button>
                <button type="button" onClick={() => setRequestType('WITHDRAWAL')} className={`py-2 rounded-xl font-black text-xs transition border cursor-pointer ${requestType === 'WITHDRAWAL' ? 'bg-[var(--loss)] border-[var(--loss)] text-white' : 'bg-[var(--bg-surface-inset)] border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                  <ArrowUpRight className="w-3.5 h-3.5 inline mr-1" /> Request Withdrawal
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Amount (₹)</label>
                  <input type="number" min="1" step="any" value={fundAmountInput} onChange={(e) => setFundAmountInput(e.target.value)} className={`${inputClass} font-mono font-bold`} />
                </div>
                <div>
                  <label className={labelClass}>Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                    <option value="UPI">UPI Transfer</option>
                    <option value="IMPS_NEFT">IMPS / NEFT</option>
                    <option value="BANK_TRANSFER">Bank Wire Transfer</option>
                    <option value="WALLET">Digital Wallet</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Presets:</span>
                {[500, 1000, 5000, 10000, 25000, 50000].map((preset) => (
                  <button key={preset} type="button" onClick={() => setFundAmountInput(preset.toString())}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition border cursor-pointer ${fundAmount === preset ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-[var(--bg-surface-inset)] border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                    ₹{preset >= 1000 ? `${preset / 1000}k` : preset}
                  </button>
                ))}
                {requestType === 'WITHDRAWAL' && (
                  <button type="button" onClick={() => setFundAmountInput(Math.floor(availableBalance).toString())} className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold border border-[var(--border-color)] text-[var(--gain)] bg-[var(--bg-surface-inset)] cursor-pointer">Max</button>
                )}
              </div>

              {requestType === 'DEPOSIT' && paymentMethod === 'UPI' && (() => {
                const handleCopyUpi = () => {
                  navigator.clipboard?.writeText(paymentConfig.upiId);
                  setCopiedUpi(true);
                  setTimeout(() => setCopiedUpi(false), 2000);
                };

                return (
                  <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-4 shadow-sm">
                    {/* Header Banner */}
                    <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-[var(--gain)]/10 text-[var(--gain)]">
                          <QrCode className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-[var(--text-main)] block uppercase tracking-wider">
                            UPI Instant Deposit
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] block">
                            Scan QR, copy UPI ID, or use Quick Pay links
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[var(--gain)] bg-[var(--gain-light)] px-2.5 py-0.5 rounded-full border border-[var(--gain)]/30">
                        Zero Surcharge
                      </span>
                    </div>

                    {/* QR Code & Payee Details Section (Responsive: Stack on mobile, side-by-side on desktop) */}
                    <div className="flex flex-col md:flex-row items-center gap-5 bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)]">
                      {/* Static QR Code Image */}
                      <div className="w-36 h-36 bg-white p-2 rounded-2xl border border-[var(--border-color)] shrink-0 flex items-center justify-center shadow-md">
                        <img
                          src={paymentConfig.qrImageUrl || '/upi-qr.png'}
                          alt="Merchant UPI Deposit QR"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/upi-qr.png';
                          }}
                        />
                      </div>

                      {/* Payee Info & Copy UPI ID */}
                      <div className="flex-1 w-full space-y-3 text-center md:text-left">
                        <div>
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-0.5">
                            Merchant Payee Name
                          </span>
                          <span className="text-sm font-extrabold text-[var(--text-main)] block">
                            {paymentConfig.merchantName}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                            Merchant UPI ID (VPA)
                          </span>
                          <div className="inline-flex items-center gap-2 bg-[var(--bg-body)] px-3 py-1.5 rounded-xl border border-[var(--border-color)] shadow-xs">
                            <span className="text-xs font-mono font-extrabold text-[var(--primary)] select-all">
                              {paymentConfig.upiId}
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyUpi}
                              className="p-1 rounded-lg hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                              title="Copy UPI ID"
                            >
                              {copiedUpi ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                                  <Check className="w-3.5 h-3.5" /> Copied
                                </span>
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                          Open Google Pay, PhonePe, Paytm, BHIM, or any UPI app to scan this QR or transfer funds to the merchant UPI ID.
                        </p>
                      </div>
                    </div>

                    {/* Quick Pay Direct Links Section (Responsive: Stack on mobile, row on desktop) */}
                    {paymentConfig.quickPayLinks && paymentConfig.quickPayLinks.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider block">
                            ⚡ Quick Pay Direct Hosted Links:
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)]">Instant Gateway Checkout</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          {paymentConfig.quickPayLinks.map((item, idx) => (
                            <a
                              key={idx}
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-[var(--gain)]/50 flex items-center justify-between md:flex-col md:items-center md:justify-center gap-1.5 transition-all shadow-xs group cursor-pointer"
                            >
                              <div className="text-left md:text-center">
                                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">
                                  Fixed Deposit
                                </span>
                                <span className="text-sm font-mono font-black text-[var(--gain)] block">
                                  ₹{item.amount.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-[var(--text-on-accent)] bg-[var(--primary)] group-hover:bg-[var(--primary-hover)] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors shadow-2xs">
                                <span>Pay Now</span>
                                <ExternalLink className="w-3 h-3" />
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step Guidance */}
                    <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[11px] text-[var(--text-muted)] space-y-1">
                      <div className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[var(--gain)]" />
                        <span>How to complete your deposit:</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-[var(--text-muted)]">
                        <li>Scan the QR code, transfer to the UPI ID, or tap a Quick Pay amount link above.</li>
                        <li>Copy the 12-digit UTR / Transaction Reference Number from your payment receipt.</li>
                        <li>Paste the UTR number in the Reference / Note field below and tap Submit.</li>
                      </ol>
                    </div>
                  </div>
                );
              })()}

              <div><label className={labelClass}>Reference / Note (optional)</label><input type="text" value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} placeholder="e.g. UTR number / remarks" className={inputClass} /></div>
              <InfoMessage msg={fundMessage} />
              <Button type="submit" disabled={submittingFundReq || fundAmount <= 0} variant={requestType === 'DEPOSIT' ? 'primary' : 'destructive'} className="w-full justify-center">
                {submittingFundReq ? 'Processing...' : `Submit ${requestType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} Request for Admin Approval`}
              </Button>
            </form>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="p-3">
              <div className="px-1 pb-2 text-xs font-bold text-[var(--text-main)] uppercase tracking-wide">Fund Request History</div>
              <DataTable columns={fundColumns} rows={fundRequests} rowKey={(r) => r.id} emptyMessage="No fund requests recorded yet." />
            </div>
          </Card>
        </div>
        );
      })()}

      {/* SUPPORT TAB */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <CardHeader className="mb-0">
              <CardTitle className="flex items-center gap-2"><HelpCircle className="w-4 h-4 text-[var(--warning)]" /> Create Support Ticket</CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmitSupportTicket} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Category</label>
                  <select value={supportCategory} onChange={(e) => setSupportCategory(e.target.value)} className={inputClass}>
                    <option value="TRADING">Trading & Execution</option>
                    <option value="KYC">KYC & Account Verification</option>
                    <option value="FUNDS">Funds & Withdrawal</option>
                    <option value="TECHNICAL">App & Technical Issue</option>
                    <option value="OTHER">General Query</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Priority</label>
                  <select value={supportPriority} onChange={(e) => setSupportPriority(e.target.value)} className={inputClass}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent / Trade Assistance</option>
                  </select>
                </div>
              </div>
              <div><label className={labelClass}>Subject</label><input type="text" required placeholder="Brief summary of your request" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Detailed Description</label><textarea required rows={3} placeholder="Explain your issue in detail..." value={supportDesc} onChange={(e) => setSupportDesc(e.target.value)} className={inputClass} /></div>
              <InfoMessage msg={supportMsg} />
              <Button type="submit" disabled={submittingSupport} leftIcon={<MessageSquare className="w-4 h-4" />}>{submittingSupport ? 'Submitting Ticket...' : 'Submit Support Ticket'}</Button>
            </form>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="p-3">
              <div className="px-1 pb-2 text-xs font-bold text-[var(--text-main)] uppercase tracking-wide">My Support Tickets</div>
              <DataTable columns={ticketColumns} rows={supportTickets} rowKey={(t) => t.id} emptyMessage="No support tickets submitted yet." />
            </div>
          </Card>
        </div>
      )}

      {/* PERMISSIONS TAB (staff only) */}
      {activeTab === 'permissions' && isStaff && (
        <Card padding="none" className="overflow-hidden">
          <PermissionsDashboard token={token} />
        </Card>
      )}

      {/* APPEARANCE TAB */}
      {activeTab === 'appearance' && (
        <Card className="space-y-5">
          <CardHeader className="pb-4 border-b border-[var(--border-color)] mb-0">
            <div>
              <CardTitle>Appearance & Theme</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Switch between Lite Mode (light) and Dark Mode for the whole app.</p>
            </div>
            <Badge variant={theme === 'light' ? 'warning' : 'info'}>{theme === 'light' ? 'Lite Mode Active' : 'Dark Mode Active'}</Badge>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['light', 'dark'] as const).map((mode) => (
              <div key={mode}
                onClick={() => { if (theme !== mode && onToggleTheme) onToggleTheme(); }}
                className={`p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${theme === mode ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30 bg-[var(--primary-light)]' : 'border-[var(--border-color)] bg-[var(--bg-surface-inset)] hover:border-[var(--primary)]/40'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center">
                      {mode === 'light' ? <Sun className="w-5 h-5 text-[var(--warning)]" /> : <Moon className="w-5 h-5 text-[var(--info)]" />}
                    </div>
                    <h4 className="font-extrabold text-sm text-[var(--text-main)] capitalize">{mode === 'light' ? 'Lite Mode' : 'Dark Mode'}</h4>
                  </div>
                  {theme === mode && <CheckCircle2 className="w-5 h-5 text-[var(--primary)]" />}
                </div>
                <p className="text-xs text-[var(--text-muted)]">{mode === 'light' ? 'High-contrast light background, best for bright environments.' : 'Reduced eye strain for extended trading sessions.'}</p>
                <Button variant={theme === mode ? 'primary' : 'secondary'} size="sm" onClick={(e) => { e.stopPropagation(); if (theme !== mode && onToggleTheme) onToggleTheme(); }}>
                  {theme === mode ? 'Selected' : `Switch to ${mode === 'light' ? 'Lite' : 'Dark'} Mode`}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* NOTIFICATIONS & SOUNDS TAB */}
      {activeTab === 'notifications' && (
        <SoundSettingsView />
      )}

      {/* Confirm before signing out — per confirmation-dialogs, an action that
          drops the session shouldn't fire on a single stray tap. */}
      <Dialog
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title={<span className="flex items-center gap-2"><LogOut className="w-4 h-4 text-[var(--loss)]" />Sign out?</span>}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsLogoutModalOpen(false)}>Stay signed in</Button>
            <Button variant="destructive" leftIcon={<LogOut className="w-4 h-4" />} onClick={onLogout}>Sign out</Button>
          </>
        }
      >
        <p className="text-xs text-[var(--text-muted)]">
          You&rsquo;ll be returned to the sign-in screen. Open positions and pending orders keep running &mdash; signing out only ends this session on this device.
        </p>
      </Dialog>
    </div>
  );
};
