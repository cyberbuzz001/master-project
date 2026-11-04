import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  User as UserIcon, ShieldCheck, Wallet as WalletIcon, Lock, CheckCircle2, AlertTriangle,
  Clock, RefreshCw, Save, Building2, UploadCloud, KeyRound, HelpCircle, Shield,
  Sun, Moon, ArrowUpRight, ArrowDownLeft, QrCode, ExternalLink, Smartphone, MessageSquare, LogOut, Copy, Check,
  Zap, FileText, Sparkles, Volume2, ChevronRight
} from 'lucide-react';
import { User, Wallet, isStaffUser } from '../types';
import { Card, CardHeader, CardTitle, Badge, Tabs, DataTable, DataTableColumn, Button, Dialog } from './ui';
import { PermissionsDashboard } from './admin/PermissionsDashboard';
import { SoundSettingsView } from './SoundSettingsView';
import { soundManager } from '../utils/soundManager';
import { launchUpiApp, SupportedUpiApp } from '../utils/upiPayment';

const GPayIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

const PhonePeIcon = () => (
  <div className="w-5 h-5 rounded-full bg-[#5f259f] flex items-center justify-center text-white font-black text-[11px] shadow-xs">
    पे
  </div>
);

const PaytmIcon = () => (
  <div className="w-5 h-5 rounded bg-[#002e6e] flex items-center justify-center text-[#00baf2] font-black text-[8px] tracking-tight shadow-xs">
    Pay
  </div>
);

const BhimIcon = () => (
  <div className="w-5 h-5 rounded bg-gradient-to-r from-orange-500 to-green-600 flex items-center justify-center text-white font-black text-[8px] tracking-tight shadow-xs">
    UPI
  </div>
);

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
  const [showPersonalForm, setShowPersonalForm] = useState(false);

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

  const handleLaunchUpi = (app: SupportedUpiApp) => {
    if (fundAmount <= 0) {
      setFundMessage({ type: 'error', text: 'Please enter a valid deposit amount greater than ₹0' });
      return;
    }
    navigator.vibrate?.(25);
    launchUpiApp(app, {
      upiId: paymentConfig.upiId || 'expertstokks@axl',
      merchantName: paymentConfig.merchantName || 'Trade Grow Brokerage',
      amount: fundAmount,
      note: 'TradeGrow Margin Deposit'
    });
  };

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
      <Card padding="none" className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[var(--info)] flex items-center justify-center text-white text-base sm:text-xl font-black shadow-md flex-shrink-0">
              {(fullName || user.username || 'T').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-bold text-[var(--text-main)]">{fullName || user.username}</h2>
                <Badge variant={isKycVerified ? 'gain' : 'warning'} dot className="text-[10px] py-0.5 px-2">{isKycVerified ? 'KYC Verified' : 'KYC Pending'}</Badge>
                {isStaff && <Badge variant="primary" className="text-[10px] py-0.5 px-2">{user.role}</Badge>}
              </div>
              <p className="text-[11px] sm:text-xs text-[var(--text-muted)] font-medium mt-0.5">
                {user.email} <span className="mx-1 opacity-50">•</span> TG-{user.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <div className="bg-[var(--bg-surface-inset)] border border-[var(--border-color)] px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl self-stretch sm:self-auto flex sm:block items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Available Margin</span>
            <span className="text-sm sm:text-base font-black text-[var(--gain)] num-font sm:block">₹{(wallet?.cashBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </Card>

      <Tabs
        ariaLabel="Profile section"
        value={activeTab}
        onChange={(v) => navigate(`/profile/${v}`)}
        items={TAB_META.filter((t) => !t.staffOnly || isStaff).map((t) => ({ value: t.key, label: t.label, icon: t.icon }))}
      />

      {/* ACCOUNT TAB (Matching Image 7: media_1793704911890_2bfa5340.jpg) */}
      {activeTab === 'account' && (
        <div className="space-y-4">
          {/* TRADING BALANCE HERO CARD */}
          <div className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xs space-y-2.5 sm:space-y-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => navigate('/profile/funds')}>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                  <span>Trading Balance</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl sm:text-3xl font-black text-[var(--text-main)] num-font mt-0.5 tabular-nums tracking-tight">
                  ₹{(wallet?.cashBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[var(--text-muted)] bg-[var(--bg-surface-inset)] px-2.5 py-1 rounded-lg border border-[var(--border-color)]/60">
              <Clock className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
              <span>Last updated at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} today</span>
            </div>

            {/* WITHDRAW & ADD FUNDS BUTTONS */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setRequestType('WITHDRAWAL');
                  navigate('/profile/funds');
                }}
                className="py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl border-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 font-bold text-xs sm:text-sm tracking-wider uppercase hover:bg-blue-50 dark:hover:bg-blue-950/20 active:scale-[0.98] transition-all cursor-pointer text-center"
              >
                Withdraw
              </button>
              <button
                type="button"
                onClick={() => {
                  setRequestType('DEPOSIT');
                  navigate('/profile/funds');
                }}
                className="py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm tracking-wider uppercase shadow-xs active:scale-[0.98] transition-all cursor-pointer text-center"
              >
                Add Funds
              </button>
            </div>
          </div>

          {/* TWO TILES: PLEDGE HOLDINGS & PAY LATER MTF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => navigate('/portfolio/holdings')}
              className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-emerald-500/40 transition cursor-pointer flex items-start justify-between gap-3 shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                    ₹
                  </div>
                  <span className="font-bold text-xs text-[var(--text-main)] uppercase tracking-wide">Pledge Holdings</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                  Pledge stocks or mutual funds you hold to increase trading balance
                </p>
              </div>
            </div>

            <div
              onClick={() => navigate('/terminal')}
              className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-indigo-500/40 transition cursor-pointer flex items-start justify-between gap-3 shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs">
                    %
                  </div>
                  <span className="font-bold text-xs text-[var(--text-main)] uppercase tracking-wide">Pay Later (MTF)</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                  View and analyse your MTF margin trading funding stocks
                </p>
              </div>
            </div>
          </div>

          {/* CLIENT PROFILE ROW */}
          <div
            onClick={() => setShowPersonalForm(!showPersonalForm)}
            className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-between cursor-pointer hover:bg-[var(--bg-surface-elevated)] transition shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-base shadow-xs">
                {(fullName || user.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-main)]">{fullName || user.username}</h4>
                <span className="text-xs text-[var(--text-muted)] font-mono">Client ID: TG-{user.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </div>

          {/* REFER & EARN BANNER */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[var(--text-main)]">Refer &amp; Earn ₹1,500</h4>
                <p className="text-[11px] text-[var(--text-muted)]">Get ₹500 for each referral who activates demat</p>
              </div>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Join TradeGrow for zero brokerage stock and options trading! Register here: https://tradegrowx.in/register?ref=${user.id}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm cursor-pointer transition flex-shrink-0"
              title="Share on WhatsApp"
            >
              <MessageSquare className="w-5 h-5" />
            </a>
          </div>

          {/* REPORTS & STATEMENTS */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-3 shadow-xs">
            <div>
              <h4 className="text-xs font-black text-[var(--text-main)] uppercase tracking-wider">Reports and Statements</h4>
              <p className="text-[11px] text-[var(--text-muted)]">All your investments and trading in one place</p>
            </div>
            <div className="divide-y divide-[var(--border-color)]">
              <button
                type="button"
                onClick={() => navigate('/profile/funds')}
                className="w-full py-2.5 flex items-center justify-between text-left hover:text-[var(--primary)] transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-xs font-bold text-[var(--text-main)]">Statement (Ledger &amp; P&amp;L)</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/portfolio/journal')}
                className="w-full py-2.5 flex items-center justify-between text-left hover:text-[var(--primary)] transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-xs font-bold text-[var(--text-main)]">Trader's Diary &amp; Journal</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>

          {/* EDIT PERSONAL PROFILE CARD */}
          <Card className="space-y-4">
            <CardHeader className="pb-3 border-b border-[var(--border-color)] mb-0 flex items-center justify-between">
              <div>
                <CardTitle>Personal Details &amp; Contact Info</CardTitle>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Official contact details for trading communications.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPersonalForm(!showPersonalForm)}
                className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
              >
                {showPersonalForm ? 'Collapse' : 'Edit Details'}
              </button>
            </CardHeader>

            {showPersonalForm ? (
              <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelClass}>Client / Account ID</label><input type="text" disabled value={user.id} className={`${inputClass} opacity-60 cursor-not-allowed font-mono`} /></div>
                  <div><label className={labelClass}>Username</label><input type="text" disabled value={user.username} className={`${inputClass} opacity-60 cursor-not-allowed font-mono`} /></div>
                </div>

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
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Legal Name</span>
                  <span className="font-semibold text-[var(--text-main)]">{fullName || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Phone</span>
                  <span className="font-semibold text-[var(--text-main)] font-mono">{phoneNumber || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">City</span>
                  <span className="font-semibold text-[var(--text-main)]">{city || 'Not provided'}</span>
                </div>
              </div>
            )}

            {/* Sign out */}
            <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-[var(--text-main)]">Sign out</h4>
                <p className="text-[11px] text-[var(--text-muted)]">Ends session on this device safely.</p>
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
          </Card>
        </div>
      )}

      {/* KYC TAB */}
      {activeTab === 'kyc' && (
        <Card padding="none" className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl space-y-4 sm:space-y-6">
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
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-3">
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
        <Card padding="none" className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl space-y-4 sm:space-y-5">
          <CardHeader className="pb-3 sm:pb-4 border-b border-[var(--border-color)] mb-0 flex-wrap gap-2">
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
        <Card padding="none" className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl space-y-4 sm:space-y-5">
          <CardHeader className="pb-3 sm:pb-4 border-b border-[var(--border-color)] mb-0">
            <div>
              <CardTitle>Security &amp; Authentication</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage your password, active sessions, and multi-factor security.</p>
            </div>
          </CardHeader>

          {/* Active Session & Device Audit Panel */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-3">
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

      {/* FUNDS TAB (Streamlined Simple 1-Tap UPI Deposit & Withdrawal) */}
      {activeTab === 'funds' && (() => {
        const totalCapital = (wallet?.cashBalance ?? 0) + (wallet?.usedMargin ?? 0);
        const usedMargin = wallet?.usedMargin ?? 0;
        const availableTrade = wallet?.cashBalance ?? 0;
        const availableWithdraw = Math.max(0, availableTrade);
        const marginUtilPct = totalCapital > 0 ? (usedMargin / totalCapital) * 100 : 0;

        const handleCopyUpi = () => {
          navigator.clipboard?.writeText(paymentConfig.upiId || 'expertstokks@axl');
          setCopiedUpi(true);
          setTimeout(() => setCopiedUpi(false), 2000);
        };

        return (
          <div className="space-y-4">
            {/* HERO BALANCE & MARGIN CARD */}
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 num-font">
                <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-0.5 sm:mb-1">Total Net Balance</span>
                  <span className="text-sm sm:text-lg font-black text-[var(--text-main)] tabular-nums tracking-tight">₹{totalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-0.5 sm:mb-1">Available to Trade</span>
                  <span className="text-sm sm:text-lg font-black text-[var(--gain)] tabular-nums tracking-tight">₹{availableTrade.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-0.5 sm:mb-1">Available to Withdraw</span>
                  <span className="text-sm sm:text-lg font-black text-indigo-500 tabular-nums tracking-tight">₹{availableWithdraw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-0.5 sm:mb-1">Blocked / Used Margin</span>
                  <span className="text-sm sm:text-lg font-black text-[var(--warning)] tabular-nums tracking-tight">₹{usedMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
              </div>
            </Card>

            {/* ZERO BROKERAGE SAVINGS */}
            <Card className="p-4 sm:p-5 relative overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-[var(--bg-surface)] via-emerald-950/10 to-[var(--bg-surface)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--text-main)]">Zero Brokerage Savings</h3>
                    <p className="text-xs text-[var(--text-muted)]">Lifetime saved: ₹{(savings?.totalSaved ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} vs standard brokers</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  100% Free
                </span>
              </div>
            </Card>

            {/* STREAMLINED DEPOSIT & WITHDRAWAL CARD */}
            <Card className="space-y-5">
              {/* TWO LARGE TABS: ADD FUNDS & WITHDRAW */}
              <div className="grid grid-cols-2 gap-2 bg-[var(--bg-surface-inset)] p-1 rounded-xl border border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => {
                    setRequestType('DEPOSIT');
                    setFundMessage(null);
                  }}
                  className={`py-2.5 rounded-lg font-black text-xs sm:text-sm tracking-wide transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    requestType === 'DEPOSIT'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" /> Add Funds
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRequestType('WITHDRAWAL');
                    setFundMessage(null);
                  }}
                  className={`py-2.5 rounded-lg font-black text-xs sm:text-sm tracking-wide transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    requestType === 'WITHDRAWAL'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" /> Withdraw
                </button>
              </div>

              {/* --- DEPOSIT SECTION (STREAMLINED 1-TAP UPI) --- */}
              {requestType === 'DEPOSIT' && (
                <form onSubmit={handleSubmitFundRequest} className="space-y-4">
                  {/* STEP 1: AMOUNT INPUT */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                        Step 1: Enter Deposit Amount
                      </label>
                      <span className="text-[11px] text-[var(--text-muted)]">No limit</span>
                    </div>

                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[var(--text-muted)]">₹</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={fundAmountInput}
                        onChange={(e) => setFundAmountInput(e.target.value)}
                        placeholder="50000"
                        className="w-full pl-9 pr-4 py-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] focus:border-blue-500 text-xl font-mono font-black text-[var(--text-main)] outline-none transition"
                      />
                    </div>

                    {/* Quick Preset Pills */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {[1000, 5000, 10000, 25000, 50000, 100000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setFundAmountInput(preset.toString());
                            navigator.vibrate?.(10);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition border cursor-pointer ${
                            fundAmount === preset
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-[var(--bg-surface-inset)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                          }`}
                        >
                          +₹{preset >= 100000 ? `${preset / 100000}L` : preset >= 1000 ? `${preset / 1000}k` : preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* STEP 2: 1-TAP INSTANT UPI APP BUTTONS */}
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                          <Zap className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black text-[var(--text-main)] uppercase tracking-wide">
                          Step 2: 1-Tap Instant UPI App Pay
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Zero Surcharge
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)]">
                      Tap your UPI app below to pay ₹{fundAmount.toLocaleString('en-IN')} instantly on your phone:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleLaunchUpi('gpay')}
                        className="p-3 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-blue-500 flex flex-col items-center justify-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer group"
                      >
                        <GPayIcon />
                        <span className="text-xs font-bold text-[var(--text-main)]">Google Pay</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLaunchUpi('phonepe')}
                        className="p-3 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-purple-500 flex flex-col items-center justify-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer group"
                      >
                        <PhonePeIcon />
                        <span className="text-xs font-bold text-[var(--text-main)]">PhonePe</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLaunchUpi('paytm')}
                        className="p-3 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-sky-500 flex flex-col items-center justify-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer group"
                      >
                        <PaytmIcon />
                        <span className="text-xs font-bold text-[var(--text-main)]">Paytm</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLaunchUpi('bhim')}
                        className="p-3 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-orange-500 flex flex-col items-center justify-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer group"
                      >
                        <BhimIcon />
                        <span className="text-xs font-bold text-[var(--text-main)]">BHIM / Any UPI</span>
                      </button>
                    </div>
                  </div>

                  {/* STEP 3: SCAN QR OR COPY UPI ID */}
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-28 h-28 bg-white p-2 rounded-xl border border-[var(--border-color)] shrink-0 flex items-center justify-center shadow-xs">
                      <img
                        src={paymentConfig.qrImageUrl || '/upi-qr.png'}
                        alt="Merchant UPI Deposit QR"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/upi-qr.png';
                        }}
                      />
                    </div>
                    <div className="flex-1 w-full text-center sm:text-left space-y-2">
                      <div>
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Merchant Payee</span>
                        <span className="text-xs font-black text-[var(--text-main)]">{paymentConfig.merchantName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Merchant UPI ID (VPA)</span>
                        <div className="inline-flex items-center gap-2 bg-[var(--bg-surface)] px-3 py-1.5 rounded-xl border border-[var(--border-color)]">
                          <span className="text-xs font-mono font-black text-blue-500 select-all">{paymentConfig.upiId}</span>
                          <button
                            type="button"
                            onClick={handleCopyUpi}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                            title="Copy UPI ID"
                          >
                            {copiedUpi ? (
                              <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                                <Check className="w-3.5 h-3.5" /> Copied
                              </span>
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Scan from a second device or copy the UPI ID into your banking app.
                      </p>
                    </div>
                  </div>

                  {/* STEP 4: CONFIRM DEPOSIT WITH 12-DIGIT UTR */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                        Step 3: Enter 12-Digit UTR to Complete
                      </label>
                      <span className="text-[10px] text-[var(--text-muted)]">From payment receipt</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={referenceNote}
                      onChange={(e) => setReferenceNote(e.target.value)}
                      placeholder="e.g. 431289102834 (12-digit UTR)"
                      className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] focus:border-blue-500 text-sm font-mono font-bold text-[var(--text-main)] outline-none transition"
                    />
                    <p className="text-[10px] text-[var(--text-muted)]">
                      After completing payment in Google Pay / PhonePe / Paytm, copy the 12-digit UTR reference number and submit.
                    </p>
                  </div>

                  <InfoMessage msg={fundMessage} />

                  <Button
                    type="submit"
                    disabled={submittingFundReq || fundAmount <= 0}
                    variant="primary"
                    className="w-full py-3.5 justify-center text-sm font-black shadow-md cursor-pointer"
                  >
                    {submittingFundReq ? 'Submitting...' : `Submit Deposit Request for ₹${fundAmount.toLocaleString('en-IN')}`}
                  </Button>
                </form>
              )}

              {/* --- WITHDRAWAL SECTION --- */}
              {requestType === 'WITHDRAWAL' && (
                <form onSubmit={handleSubmitFundRequest} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Withdrawal Amount</label>
                      <span className="text-[11px] text-[var(--text-muted)]">Max withdrawable: ₹{availableWithdraw.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-[var(--text-muted)]">₹</span>
                      <input
                        type="number"
                        min="1"
                        max={availableWithdraw}
                        step="any"
                        value={fundAmountInput}
                        onChange={(e) => setFundAmountInput(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full pl-8 pr-16 py-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] focus:border-rose-500 text-lg font-mono font-black text-[var(--text-main)] outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setFundAmountInput(Math.floor(availableWithdraw).toString())}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg cursor-pointer"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Bank info summary */}
                  <div className="p-3.5 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4 text-indigo-500" />
                      <div>
                        <span className="text-xs font-bold text-[var(--text-main)] block">{bankName || 'Registered Settlement Bank'}</span>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">{bankAccountNumber ? `A/C: ••••${bankAccountNumber.slice(-4)}` : 'Bank linked via KYC'}</span>
                      </div>
                    </div>
                    <Badge variant="gain">Verified</Badge>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wide block mb-1">
                      Remarks / Reference Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={referenceNote}
                      onChange={(e) => setReferenceNote(e.target.value)}
                      placeholder="e.g. Bank payout"
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>

                  <InfoMessage msg={fundMessage} />

                  <Button
                    type="submit"
                    disabled={submittingFundReq || fundAmount <= 0 || fundAmount > availableWithdraw}
                    variant="destructive"
                    className="w-full py-3.5 justify-center text-sm font-black shadow-md cursor-pointer"
                  >
                    {submittingFundReq ? 'Submitting...' : `Request Withdrawal of ₹${fundAmount.toLocaleString('en-IN')}`}
                  </Button>
                </form>
              )}
            </Card>

            {/* FUND REQUEST HISTORY TABLE */}
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
        <Card padding="none" className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl space-y-4 sm:space-y-5">
          <CardHeader className="pb-3 sm:pb-4 border-b border-[var(--border-color)] mb-0">
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
