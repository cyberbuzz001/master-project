import React, { useEffect, useRef, useState } from 'react';
import { Lock, Mail, Phone, AlertTriangle, TrendingUp, Eye, EyeOff, ShieldCheck, Zap, LineChart, Loader2, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { Button } from './ui/Button';
import { soundManager } from '../utils/soundManager';

interface AuthModalProps {
  onSuccess: (token: string, user: any) => void;
  initialMode?: 'login' | 'register';
  onModeChange?: (mode: 'login' | 'register') => void;
}

const TRUST_POINTS = [
  { icon: <ShieldCheck className="w-4 h-4" />, title: 'Regulated-grade safeguards', sub: 'RMS risk limits and auto square-off built in' },
  { icon: <Zap className="w-4 h-4" />, title: 'Live NSE & BSE market data', sub: 'Real streaming ticks, not delayed snapshots' },
  { icon: <LineChart className="w-4 h-4" />, title: 'Full F&O option chain', sub: 'Strike-level OI, IV and one-tap order entry' },
];

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, initialMode, onModeChange }) => {
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot_password'>(() => {
    if (initialMode) return initialMode;
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (p === '/register' || p === '/signup') return 'register';
    }
    return 'login';
  });
  const isLogin = authView === 'login';

  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState<string>('');
  const [forgotOtp, setForgotOtp] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [forgotUserId, setForgotUserId] = useState<string>('');

  // Registration OTP verification state
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [regOtp, setRegOtp] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (initialMode) {
      setAuthView(initialMode);
      setRegStep(1);
      setRegOtp('');
      setResendCooldown(0);
      setError(null);
      setSuccessMsg(null);
      setFormKey((k) => k + 1);
    }
  }, [initialMode]);

  // Bumped on every mode switch so the form's entrance animation replays,
  // giving the login <-> register toggle a visible transition without
  // animating height (which would thrash layout).
  const [formKey, setFormKey] = useState<number>(0);
  const errorRef = useRef<HTMLDivElement>(null);

  // Re-run the shake on each *new* error, not just the first — re-submitting
  // the same wrong password should still visibly react.
  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.classList.remove('shake');
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add('shake');
  }, [error]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normEmail = email.trim().toLowerCase();

    setIsSubmitting(true);
    fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normEmail, password }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          soundManager.playSound('login_success');
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
          onSuccess(data.token, data.user);
        } else {
          soundManager.playSound('payment_failed');
          const detailedErr = data.error?.fields?.map((f: any) => f.message).join('. ') || data.error?.message || 'Authentication failed';
          setError(detailedErr);
          setIsSubmitting(false);
        }
      })
      .catch(() => {
        soundManager.playSound('payment_failed');
        setError('Could not reach the server. Check your connection and try again.');
        setIsSubmitting(false);
      });
  };

  const handleRegisterSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const normEmail = email.trim().toLowerCase();
    const cleanPhone = phoneNumber.trim();

    if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    const digitsOnly = cleanPhone.replace(/[^0-9]/g, '');
    if (digitsOnly.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/register-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normEmail,
          phoneNumber: cleanPhone,
          ...(username.trim() ? { username: username.trim() } : {})
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.devOtp) setRegOtp(data.devOtp);
        setRegStep(2);
        setResendCooldown(60);
        setSuccessMsg(data.message || `Verification code sent to ${normEmail}.`);
      } else {
        soundManager.playSound('payment_failed');
        setError(data.error?.message || data.error || 'Failed to send verification code.');
      }
    } catch (_) {
      soundManager.playSound('payment_failed');
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterVerifyAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const normEmail = email.trim().toLowerCase();
    const cleanPhone = phoneNumber.trim();
    const cleanOtp = regOtp.trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normEmail,
          phoneNumber: cleanPhone,
          password,
          otp: cleanOtp,
          ...(username.trim() ? { username: username.trim() } : {})
        }),
      });
      const data = await res.json();
      if (data.success) {
        soundManager.playSound('login_success');
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        onSuccess(data.token, data.user);
      } else {
        soundManager.playSound('payment_failed');
        const detailedErr = data.error?.fields?.map((f: any) => f.message).join('. ') || data.error?.message || 'Registration failed';
        setError(detailedErr);
      }
    } catch (_) {
      soundManager.playSound('payment_failed');
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setError('Please enter your email, mobile number or username.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setForgotUserId(data.userId || '');
        if (data.devOtp) setForgotOtp(data.devOtp);
        setForgotStep(2);
        setSuccessMsg(data.message || 'Verification OTP generated! Check your notifications.');
      } else {
        setError(data.error || 'Failed to send OTP.');
      }
    } catch (_) {
      setError('Network error. Check connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim() || !newPassword) {
      setError('OTP and new password are required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: forgotIdentifier.trim(),
          userId: forgotUserId,
          otp: forgotOtp.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuthView('login');
        setForgotStep(1);
        setForgotOtp('');
        setNewPassword('');
        setSuccessMsg('Password has been reset! Please sign in with your new password.');
        setError(null);
      } else {
        setError(data.error || 'Failed to reset password.');
      }
    } catch (_) {
      setError('Network error. Check connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    const nextLogin = authView !== 'login';
    setAuthView(nextLogin ? 'login' : 'register');
    setRegStep(1);
    setRegOtp('');
    setResendCooldown(0);
    setError(null);
    setSuccessMsg(null);
    setFormKey((k) => k + 1);
    if (onModeChange) {
      onModeChange(nextLogin ? 'login' : 'register');
    }
  };

  const inputClass =
    'w-full min-h-[44px] bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-[var(--radius-md)] py-2.5 pl-10 pr-3 ' +
    'text-sm font-semibold text-[var(--text-main)] placeholder-[var(--text-tertiary)] outline-none ' +
    'transition-colors duration-[var(--duration-fast)] ease-[var(--easing-default)] ' +
    'focus:border-[var(--primary)] focus:bg-[var(--bg-surface)]';
  const labelClass = 'text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5';
  const iconClass = 'w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none';

  return (
    <div className="min-h-dvh w-full bg-[var(--bg-body)] text-[var(--text-main)] font-body flex items-center justify-center p-4 sm:p-6">
      <div className="auth-card w-full max-w-5xl grid lg:grid-cols-[1.05fr_1fr] rounded-[var(--radius-xl)] overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-xl)]">

        {/* ── BRAND PANEL (desktop only) ─────────────────────────────────
            Deliberately the only heavily-animated surface in the app: a
            self-drawing sparkline reinforces "live market data" at the exact
            moment we're asking for trust. Hidden below lg so the mobile
            experience stays a fast, single-purpose form. */}
        <aside className="hidden lg:flex flex-col justify-between relative overflow-hidden p-10 bg-[var(--bg-surface-inset)] border-r border-[var(--border-color)]">
          <div className="auth-glow" aria-hidden="true" />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--primary)] text-white flex items-center justify-center shadow-[var(--shadow-md)]">
                <TrendingUp className="w-5 h-5" />
              </span>
              <span className="text-xl font-black tracking-tight">
                Trade<span className="text-[var(--primary)]">Grow</span>
              </span>
            </div>

            <h1 className="mt-10 text-[28px] leading-tight font-black tracking-tight text-balance">
              The calm way to trade
              <span className="block text-[var(--primary)]">India&rsquo;s markets.</span>
            </h1>
            <p className="mt-3 text-sm text-[var(--text-muted)] leading-relaxed max-w-sm">
              Live NSE &amp; BSE data, a full F&amp;O option chain, and real risk controls &mdash; in one uncluttered terminal.
            </p>
          </div>

          {/* Self-drawing sparkline */}
          <svg className="relative z-10 w-full h-24 my-8" viewBox="0 0 320 80" fill="none" aria-hidden="true" preserveAspectRatio="none">
            <defs>
              <linearGradient id="authSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="auth-spark-fill"
              d="M0 64 L40 58 L80 62 L120 40 L160 46 L200 26 L240 32 L280 14 L320 20 L320 80 L0 80 Z"
              fill="url(#authSparkFill)"
            />
            <path
              className="auth-spark-line"
              d="M0 64 L40 58 L80 62 L120 40 L160 46 L200 26 L240 32 L280 14 L320 20"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <ul className="relative z-10 space-y-4">
            {TRUST_POINTS.map((p, i) => (
              <li key={p.title} className={`flex items-start gap-3 card-enter card-enter-${i + 2}`}>
                <span className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  {p.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text-main)]">{p.title}</div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{p.sub}</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── FORM PANEL ─────────────────────────────────────────────── */}
        <main className="p-6 sm:p-10 flex flex-col justify-center">
          {/* Compact brand lockup — only shown where the brand panel isn't */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <span className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--primary)] text-white flex items-center justify-center shadow-[var(--shadow-md)]">
              <TrendingUp className="w-5 h-5" />
            </span>
            <span className="text-lg font-black tracking-tight">
              Trade<span className="text-[var(--primary)]">Grow</span>
            </span>
          </div>

          <div key={formKey} className="card-enter">
            {authView === 'forgot_password' ? (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthView('login');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Sign In</span>
                </button>

                <h2 className="text-2xl font-black tracking-tight">
                  {forgotStep === 1 ? 'Reset Password' : 'Verify & Set Password'}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1.5">
                  {forgotStep === 1
                    ? 'Enter your registered email, mobile or username to receive a 6-digit OTP.'
                    : 'Enter the 6-digit verification code and your new password.'}
                </p>

                {error && (
                  <div
                    ref={errorRef}
                    role="alert"
                    className="mt-5 p-3.5 rounded-[var(--radius-md)] bg-[var(--loss-light)] border border-[var(--loss)]/30 text-[var(--loss)] text-xs font-bold flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="mt-5 p-3.5 rounded-[var(--radius-md)] bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-px" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {forgotStep === 1 ? (
                  <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
                    <div>
                      <label className={labelClass}>Registered Email, Mobile or Username</label>
                      <div className="relative">
                        <Mail className={iconClass} aria-hidden="true" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. trader@example.com or 9876543210"
                          value={forgotIdentifier}
                          onChange={(e) => setForgotIdentifier(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                      className="w-full justify-center mt-2"
                    >
                      {isSubmitting ? 'Sending OTP…' : 'Send Verification OTP'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
                    <div>
                      <label className={labelClass}>6-Digit Verification OTP</label>
                      <div className="relative">
                        <KeyRound className={iconClass} aria-hidden="true" />
                        <input
                          type="text"
                          required
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={forgotOtp}
                          onChange={(e) => setForgotOtp(e.target.value)}
                          className={`${inputClass} font-mono tracking-widest text-center text-base`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>New Password (At least 8 chars)</label>
                      <div className="relative">
                        <Lock className={iconClass} aria-hidden="true" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Enter your new secure password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={`${inputClass} pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-main)]"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                      className="w-full justify-center mt-2"
                    >
                      {isSubmitting ? 'Resetting Password…' : 'Reset Password & Sign In'}
                    </Button>
                  </form>
                )}
              </div>
            ) : !isLogin && regStep === 2 ? (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setRegStep(1);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] mb-4 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Change details / email</span>
                </button>

                <h2 className="text-2xl font-black tracking-tight">Verify Your Email</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1.5">
                  We've sent a 6-digit verification code to <strong className="text-[var(--text-main)]">{email}</strong>. Enter it below to activate your trading account:
                </p>

                {error && (
                  <div
                    ref={errorRef}
                    role="alert"
                    className="mt-5 p-3.5 rounded-[var(--radius-md)] bg-[var(--loss-light)] border border-[var(--loss)]/30 text-[var(--loss)] text-xs font-bold flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="mt-5 p-3.5 rounded-[var(--radius-md)] bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-px" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <form onSubmit={handleRegisterVerifyAndSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className={labelClass}>6-Digit Verification Code</label>
                    <div className="relative">
                      <KeyRound className={iconClass} aria-hidden="true" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        autoFocus
                        placeholder="••••••"
                        value={regOtp}
                        onChange={(e) => setRegOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                        className={`${inputClass} font-mono tracking-widest text-center text-lg`}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2.5 text-xs">
                      <span className="text-[var(--text-muted)] text-[11px]">Didn't get the code?</span>
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || isSubmitting}
                        onClick={() => handleRegisterSendOtp()}
                        className="font-bold text-[var(--primary)] hover:underline disabled:opacity-40 disabled:no-underline text-xs cursor-pointer"
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting || regOtp.length !== 6}
                    leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : undefined}
                    className="w-full justify-center mt-2"
                  >
                    {isSubmitting ? 'Verifying & Activating…' : 'Verify & Complete Registration'}
                  </Button>
                </form>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-black tracking-tight">
                  {isLogin ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1.5">
                  {isLogin ? 'Sign in to your trading terminal.' : 'Enter your details to receive an email verification code.'}
                </p>

                {error && (
                  <div
                    ref={errorRef}
                    role="alert"
                    className="mt-5 p-3.5 rounded-[var(--radius-md)] bg-[var(--loss-light)] border border-[var(--loss)]/30 text-[var(--loss)] text-xs font-bold flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="mt-5 p-3.5 rounded-[var(--radius-md)] bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-px" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <form onSubmit={isLogin ? handleLoginSubmit : handleRegisterSendOtp} className="mt-6 space-y-4">
                  <div className="card-enter card-enter-1">
                    <label htmlFor="auth-email" className={labelClass}>
                      {isLogin ? 'Email, username, mobile or client ID' : 'Email address'}
                    </label>
                    <div className="relative">
                      <Mail className={iconClass} aria-hidden="true" />
                      <input
                        id="auth-email"
                        type={isLogin ? 'text' : 'email'}
                        required
                        autoComplete={isLogin ? 'username' : 'email'}
                        inputMode={isLogin ? 'text' : 'email'}
                        placeholder={isLogin ? 'you@example.com or 9876543210' : 'you@example.com'}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {!isLogin && (
                    <div className="card-enter card-enter-2">
                      <label htmlFor="auth-phone" className={labelClass}>
                        Full Mobile Number
                      </label>
                      <div className="relative">
                        <Phone className={iconClass} aria-hidden="true" />
                        <input
                          id="auth-phone"
                          type="tel"
                          required
                          autoComplete="tel"
                          inputMode="tel"
                          placeholder="10-digit mobile number (e.g. 9876543210)"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        Required for trade alerts, security notifications, and account verification.
                      </p>
                    </div>
                  )}

                  <div className="card-enter card-enter-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="auth-password" className={`${labelClass} !mb-0`}>Password</label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthView('forgot_password');
                            setError(null);
                            setSuccessMsg(null);
                            setForgotStep(1);
                          }}
                          className="text-[11px] font-bold text-[var(--primary)] hover:underline"
                        >
                          Forgot?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className={iconClass} aria-hidden="true" />
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        placeholder={isLogin ? 'Enter your password' : 'At least 8 characters'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputClass} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : undefined}
                    className="w-full justify-center card-enter card-enter-4 mt-1"
                  >
                    {isSubmitting
                      ? (isLogin ? 'Signing in…' : 'Sending Verification Code…')
                      : (isLogin ? 'Sign in' : 'Continue & Verify Email')}
                  </Button>
                </form>

                <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
                  {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button
                    type="button"
                    onClick={switchMode}
                    className="font-bold text-[var(--primary)] hover:underline underline-offset-2"
                  >
                    {isLogin ? 'Create one' : 'Sign in'}
                  </button>
                </p>

                <p className="mt-8 text-center text-[10px] leading-relaxed text-[var(--text-tertiary)]">
                  Simulated trade execution. Market data is live; orders are not routed to an exchange.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
