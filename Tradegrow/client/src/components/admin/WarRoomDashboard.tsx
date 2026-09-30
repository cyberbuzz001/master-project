import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Target, Users, Zap, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, ArrowDownRight, Flame, Share2, Award, PhoneCall, RefreshCw,
  MessageCircle, Megaphone, FileText, ChevronRight, BarChart3, Send,
  Smartphone, Globe, Instagram, Youtube, UserPlus, Radio, Sparkles,
  Calendar, DollarSign, Eye, BookOpen, Filter, Search, ExternalLink, ShieldCheck
} from 'lucide-react';

/* ─────────────────────────── Types ─────────────────────────── */
interface WarRoomDashboardProps { token: string; }

interface DashboardState {
  data: any;
  pacing: any[];
  creators: any[];
  contentIdeas: any[];
  whatsappMessages: any[];
  referralStats: any;
}

type TabId = 'command' | 'pacing' | 'creators' | 'content' | 'whatsapp';

/* ─────────────────── Utility Helpers ─────────────────── */
const paisa = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const pct = (n: number, d: number) => d > 0 ? ((n / d) * 100).toFixed(1) : '0.0';
const cls = (...c: (string | boolean | undefined | null)[]) => c.filter(Boolean).join(' ');

/* ─────────────────── Animated Counter ─────────────────── */
const AnimNum: React.FC<{ value: number; duration?: number }> = ({ value, duration = 800 }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === display) return;
    const start = display;
    const diff = value - start;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{display.toLocaleString('en-IN')}</>;
};

/* ─────────────────── Funnel Stage Viz ─────────────────── */
const FunnelBar: React.FC<{ label: string; value: number; max: number; color: string; icon: React.ReactNode; subLabel?: string }> = ({ label, value, max, color, icon, subLabel }) => {
  const width = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <div className="group relative">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
        {subLabel && <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">{subLabel}</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-7 bg-[var(--bg-surface-elevated)] rounded-lg overflow-hidden border border-[var(--border-color)]">
          <div
            className="h-full rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-2"
            style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color}22, ${color}88)` }}
          >
            {value > 0 && <span className="text-[10px] font-bold" style={{ color }}>{value.toLocaleString('en-IN')}</span>}
          </div>
        </div>
        <span className="text-sm font-black text-[var(--text-main)] w-16 text-right tabular-nums">{value.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
};

/* ─────────────────── Micro Stat Card ─────────────────── */
const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; accent?: string; sub?: string; pulse?: boolean }> = ({ label, value, icon, accent, sub, pulse }) => (
  <div className={cls(
    "relative overflow-hidden rounded-xl border p-4 transition-all duration-200",
    accent ? `border-[${accent}]/20` : "border-[var(--border-color)]",
    "bg-[var(--bg-surface)] hover:shadow-md hover:border-[var(--primary)]/30"
  )}>
    {pulse && <div className="absolute top-2 right-2"><span className="flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span></div>}
    <div className="flex items-center gap-2 mb-2 text-[var(--text-muted)]">
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-xl font-black text-[var(--text-main)] tabular-nums">{value}</p>
    {sub && <p className="text-[10px] text-[var(--text-tertiary)] mt-1 font-medium">{sub}</p>}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export const WarRoomDashboard: React.FC<WarRoomDashboardProps> = ({ token }) => {
  const [state, setState] = useState<DashboardState>({
    data: null, pacing: [], creators: [], contentIdeas: [], whatsappMessages: [], referralStats: null
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('command');
  const [contentFilter, setContentFilter] = useState('');
  const [contentCategory, setContentCategory] = useState('');

  // WhatsApp Sender State
  const [waPhone, setWaPhone] = useState('');
  const [waName, setWaName] = useState('');
  const [waSequence, setWaSequence] = useState<'CUSTOM' | 'LEAD_WELCOME' | 'KYC_NUDGE' | 'ACTIVATION' | 'FIRST_TRADE'>('CUSTOM');
  const [waText, setWaText] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [waStatus, setWaStatus] = useState<any>(null);
  const [waResult, setWaResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  /* ───── Parallel Data Fetch ───── */
  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dashR, pacR, creatR, contentR, waR, waStatR] = await Promise.allSettled([
        fetch('/api/v1/warroom/dashboard', { headers }).then(r => r.json()),
        fetch('/api/v1/warroom/pacing?limit=14', { headers }).then(r => r.json()),
        fetch('/api/v1/warroom/creators', { headers }).then(r => r.json()),
        fetch('/api/v1/warroom/content-ideas', { headers }).then(r => r.json()),
        fetch('/api/v1/warroom/whatsapp/messages?limit=30', { headers }).then(r => r.json()),
        fetch('/api/v1/warroom/whatsapp/status', { headers }).then(r => r.json()),
      ]);

      setState(prev => ({
        ...prev,
        data: dashR.status === 'fulfilled' && dashR.value.success ? dashR.value.data : prev.data,
        pacing: pacR.status === 'fulfilled' && pacR.value.success ? pacR.value.data : prev.pacing,
        creators: creatR.status === 'fulfilled' && creatR.value.success ? creatR.value.data : prev.creators,
        contentIdeas: contentR.status === 'fulfilled' && contentR.value.success ? contentR.value.data : prev.contentIdeas,
        whatsappMessages: waR.status === 'fulfilled' && waR.value.success ? waR.value.data : prev.whatsappMessages,
      }));

      if (waStatR.status === 'fulfilled' && waStatR.value.success) {
        setWaStatus(waStatR.value.data);
      }
    } catch (e) {
      console.error('[WarRoom] Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [headers]);

  const handleSendWa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waPhone.trim()) {
      setWaResult({ success: false, message: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    setWaSending(true);
    setWaResult(null);

    try {
      let body: any;
      if (waSequence === 'CUSTOM') {
        if (!waText.trim()) {
          setWaResult({ success: false, message: 'Please enter your message text.' });
          setWaSending(false);
          return;
        }
        body = {
          sequence: 'CUSTOM',
          phone: waPhone.trim(),
          textBody: waText.trim()
        };
      } else {
        body = {
          sequence: waSequence,
          phone: waPhone.trim(),
          fullName: waName.trim() || undefined,
        };
      }

      const res = await fetch('/api/v1/warroom/whatsapp/trigger-sequence', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        setWaResult({ success: true, message: `✅ Message dispatched to ${waPhone} successfully! Anti-ban jitter queued.` });
        if (waSequence === 'CUSTOM') setWaText('');
        fetchAll();
      } else {
        const errMsg = data.error?.message || data.data?.error || data.error || 'Dispatch rejected. Ensure WhatsApp device is connected.';
        setWaResult({ success: false, message: `❌ ${errMsg}` });
      }
    } catch (err: any) {
      setWaResult({ success: false, message: `❌ Network error: ${err.message}` });
    } finally {
      setWaSending(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30_000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  /* ───── Data Destructuring ───── */
  const d = state.data;
  const goal = d?.goal || { targetUsers: 1000, currentActivated: 0, remainingUsers: 1000, completionPercentage: 0, daysRemaining: 90, requiredDailyRunRate: 11.1, currentDailyRunRate: 0 };
  const econ = d?.economics || { totalBudgetPaisa: 75000000, totalSpentPaisa: 0, currentCpauPaisa: 0, targetCpauPaisa: 75000, cpauVariancePct: 0 };
  const today = d?.todayPacing || { date: new Date().toISOString().split('T')[0], targetLeads: 56, actualLeads: 0, targetKyc: 16, actualKyc: 0, targetActivations: 11, actualActivations: 0, varianceActivations: -11, status: 'ON_TRACK' };
  const funnel = d?.funnelSummary || { totalLeads: 0, kycStarted: 0, kycCompleted: 0, approvedAccounts: 0, activatedUsers: 0 };
  const channels = d?.channelBreakdown || [];
  const alerts = d?.alerts || [];

  /* ───── Content Filtering ───── */
  const categories = useMemo(() => {
    const cats = new Set(state.contentIdeas.map((c: any) => c.category));
    return Array.from(cats).sort();
  }, [state.contentIdeas]);

  const filteredContent = useMemo(() => {
    return state.contentIdeas.filter((c: any) => {
      const matchesSearch = !contentFilter || c.hook?.toLowerCase().includes(contentFilter.toLowerCase()) || c.script_body?.toLowerCase().includes(contentFilter.toLowerCase());
      const matchesCat = !contentCategory || c.category === contentCategory;
      return matchesSearch && matchesCat;
    });
  }, [state.contentIdeas, contentFilter, contentCategory]);

  /* ───── Loading State ───── */
  if (loading && !d) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-[var(--border-color)] border-t-[var(--primary)] animate-spin" />
            <Target className="w-6 h-6 text-[var(--primary)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm font-bold text-[var(--text-muted)]">Syncing 1,000 Users War Room...</p>
        </div>
      </div>
    );
  }

  /* ───── Tabs ───── */
  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'command', label: 'Command Center', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'pacing', label: 'Daily Pacing', icon: <Calendar className="w-3.5 h-3.5" />, badge: state.pacing.length },
    { id: 'creators', label: 'Creators & Affiliates', icon: <Instagram className="w-3.5 h-3.5" />, badge: state.creators.length },
    { id: 'content', label: 'Content Scripts', icon: <Megaphone className="w-3.5 h-3.5" />, badge: state.contentIdeas.length },
    { id: 'whatsapp', label: 'WhatsApp Automation', icon: <MessageCircle className="w-3.5 h-3.5" />, badge: state.whatsappMessages.length },
  ];

  return (
    <div className="space-y-0 max-w-[1400px] mx-auto">

      {/* ═══════════ HEADER BAR ═══════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 mb-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--primary)]"></span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md">
              Live Growth Ops
            </span>
          </div>
          <h1 className="text-lg font-black text-[var(--text-main)] tracking-tight">
            TRADE GROW — 1,000 ACTIVATED USERS WAR ROOM
          </h1>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-medium">
            Real-time acquisition engine · KYC recovery · Channel attribution · WhatsApp automation
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--primary)]/40 transition-all cursor-pointer"
        >
          <RefreshCw className={cls("w-3 h-3", refreshing ? "animate-spin" : "")} />
          Refresh
        </button>
      </div>

      {/* ═══════════ NORTH STAR HERO ═══════════ */}
      <div className="relative overflow-hidden rounded-2xl p-5 shadow-lg border border-[var(--primary)]/20" style={{
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--primary-light) 50%, var(--bg-surface) 100%)'
      }}>
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, var(--primary), transparent)' }} />

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* Left: Counter */}
            <div>
              <div className="flex items-center gap-2 text-[var(--primary)] text-[10px] font-extrabold uppercase tracking-[0.15em] mb-1">
                <Target className="w-3.5 h-3.5" />
                <span>90-Day North Star Milestone</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-[var(--text-main)] tabular-nums">
                  <AnimNum value={goal.currentActivated} />
                </span>
                <span className="text-xl font-medium text-[var(--text-tertiary)]">/ {goal.targetUsers}</span>
                <span className={cls(
                  "text-[11px] font-extrabold px-2.5 py-1 rounded-full ml-2 border",
                  goal.completionPercentage >= 80 ? "bg-[var(--gain-light)] text-[var(--gain)] border-[var(--gain)]/20" :
                  goal.completionPercentage >= 40 ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)]"
                )}>
                  {goal.completionPercentage}% Achieved
                </span>
              </div>
            </div>

            {/* Right: Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { label: 'Days Left', value: `${goal.daysRemaining}`, icon: <Clock className="w-3 h-3" /> },
                { label: 'Run Rate', value: `${goal.requiredDailyRunRate}/d`, icon: <Zap className="w-3 h-3" /> },
                { label: 'Current CPAU', value: paisa(econ.currentCpauPaisa), icon: <DollarSign className="w-3 h-3" /> },
                { label: 'Budget Burn', value: paisa(econ.totalSpentPaisa), icon: <Flame className="w-3 h-3" /> },
              ].map((s, i) => (
                <div key={i} className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm">
                  <div className="flex items-center justify-center gap-1 text-[var(--text-tertiary)] mb-0.5">
                    {s.icon}
                    <p className="text-[9px] uppercase tracking-wider font-bold">{s.label}</p>
                  </div>
                  <p className="text-sm font-black text-[var(--text-main)] tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] font-bold">
              <span>Sprint Progress</span>
              <span>{goal.remainingUsers} users remaining</span>
            </div>
            <div className="w-full h-3 bg-[var(--bg-surface-elevated)] rounded-full overflow-hidden border border-[var(--border-color)]">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(2, goal.completionPercentage))}%`,
                  background: `linear-gradient(90deg, var(--primary), var(--groww-green))`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ TAB NAVIGATION ═══════════ */}
      <div className="flex items-center gap-1 overflow-x-auto pt-5 pb-3 -mx-1 px-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cls(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer",
              activeTab === t.id
                ? "bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] border border-transparent"
            )}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span className={cls(
                "text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                activeTab === t.id ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)]"
              )}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════ TAB: COMMAND CENTER ═══════════ */}
      {activeTab === 'command' && (
        <div className="space-y-5">
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((alt: any) => (
                <div key={alt.id} className={cls(
                  "p-3 rounded-xl border text-xs flex items-start gap-3",
                  alt.severity === 'RED' ? "bg-[var(--loss-light)] border-[var(--loss)]/20" : "bg-amber-50 border-amber-200"
                )}>
                  <AlertTriangle className={cls("w-4 h-4 shrink-0 mt-0.5", alt.severity === 'RED' ? "text-[var(--loss)]" : "text-amber-600")} />
                  <div className="flex-1 space-y-1">
                    <p className={cls("font-bold", alt.severity === 'RED' ? "text-[var(--loss)]" : "text-amber-800")}>{alt.title}</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">{alt.message}</p>
                    <p className="text-[var(--text-tertiary)] font-semibold pt-1 border-t border-black/5">💡 {alt.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Today's Pacing + Funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Today Mini Cards */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
                Today's Target vs Actual ({today.date})
                <span className={cls(
                  "text-[9px] px-1.5 py-0.5 rounded font-extrabold ml-auto",
                  today.actualActivations >= today.targetActivations
                    ? "bg-[var(--gain-light)] text-[var(--gain)]"
                    : "bg-amber-100 text-amber-700"
                )}>{today.status}</span>
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="Leads" value={today.actualLeads} icon={<Users className="w-3.5 h-3.5" />} sub={`Target: ${today.targetLeads}`} />
                <StatCard label="KYC Done" value={today.actualKyc} icon={<CheckCircle2 className="w-3.5 h-3.5" />} sub={`Target: ${today.targetKyc}`} />
                <StatCard label="Activated" value={today.actualActivations} icon={<Zap className="w-3.5 h-3.5" />} sub={`Target: ${today.targetActivations}`} pulse />
              </div>
              <div className="text-[11px] font-bold text-[var(--text-muted)] flex justify-between px-1">
                <span>Activation Variance:</span>
                <span className={today.varianceActivations >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}>
                  {today.varianceActivations >= 0 ? '+' : ''}{today.varianceActivations} vs plan
                </span>
              </div>

              {/* Economics Row */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <StatCard label="Total Budget" value={paisa(econ.totalBudgetPaisa)} icon={<DollarSign className="w-3.5 h-3.5" />} sub={`Remaining: ${paisa(econ.totalBudgetPaisa - econ.totalSpentPaisa)}`} />
                <StatCard label="Target CPAU" value={paisa(econ.targetCpauPaisa)} icon={<Target className="w-3.5 h-3.5" />} sub={`Variance: ${econ.cpauVariancePct > 0 ? '+' : ''}${econ.cpauVariancePct}%`} />
              </div>
            </div>

            {/* Funnel Visualization */}
            <div className="lg:col-span-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-[var(--primary)]" />
                Customer Acquisition Funnel
              </h3>
              <div className="space-y-3">
                <FunnelBar label="Total Leads" value={funnel.totalLeads} max={funnel.totalLeads || 1} color="var(--gogrow-blue)" icon={<Users className="w-3 h-3" />} subLabel="100% baseline" />
                <FunnelBar label="KYC Started" value={funnel.kycStarted} max={funnel.totalLeads || 1} color="#8b5cf6" icon={<FileText className="w-3 h-3" />} subLabel={`${pct(funnel.kycStarted, funnel.totalLeads)}% of leads`} />
                <FunnelBar label="KYC Completed" value={funnel.kycCompleted} max={funnel.totalLeads || 1} color="#f59e0b" icon={<CheckCircle2 className="w-3 h-3" />} subLabel={`${pct(funnel.kycCompleted, funnel.kycStarted)}% of starts`} />
                <FunnelBar label="Approved" value={funnel.approvedAccounts} max={funnel.totalLeads || 1} color="#10b981" icon={<Award className="w-3 h-3" />} subLabel={`${pct(funnel.approvedAccounts, funnel.kycCompleted)}% of KYC`} />
                <FunnelBar label="ACTIVATED" value={funnel.activatedUsers} max={funnel.totalLeads || 1} color="var(--primary)" icon={<Zap className="w-3 h-3" />} subLabel={`${pct(funnel.activatedUsers, funnel.approvedAccounts)}% of approved`} />
              </div>
            </div>
          </div>

          {/* Channel Attribution Table */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3">
            <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
              <Share2 className="w-3.5 h-3.5 text-[var(--primary)]" />
              Channel Attribution & CPAU Efficiency
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-tertiary)] uppercase font-bold tracking-wider">
                    <th className="pb-2.5 pr-4">Channel</th>
                    <th className="pb-2.5 text-right">Leads</th>
                    <th className="pb-2.5 text-right">Activations</th>
                    <th className="pb-2.5 text-right">Conv %</th>
                    <th className="pb-2.5 text-right">Actual CPAU</th>
                    <th className="pb-2.5 text-right">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {channels.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[var(--text-tertiary)]">
                        <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">No attributed channel traffic yet</p>
                        <p className="text-[10px] mt-1">Traffic will populate when leads arrive via UTM-tagged campaigns</p>
                      </td>
                    </tr>
                  ) : channels.map((c: any, i: number) => {
                    const convRate = c.leads > 0 ? (c.activations / c.leads) * 100 : 0;
                    const isEfficient = c.cpauPaisa <= econ.targetCpauPaisa;
                    return (
                      <tr key={i} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                        <td className="py-3 pr-4 font-bold text-[var(--text-main)]">{c.channel}</td>
                        <td className="py-3 text-right text-[var(--text-muted)] tabular-nums">{c.leads}</td>
                        <td className="py-3 text-right font-black text-[var(--primary)] tabular-nums">{c.activations}</td>
                        <td className="py-3 text-right text-[var(--text-muted)] tabular-nums">{convRate.toFixed(1)}%</td>
                        <td className="py-3 text-right font-bold text-[var(--text-main)] tabular-nums">{paisa(c.cpauPaisa)}</td>
                        <td className="py-3 text-right">
                          <span className={cls("text-[10px] font-extrabold px-1.5 py-0.5 rounded",
                            isEfficient ? "bg-[var(--gain-light)] text-[var(--gain)]" : "bg-[var(--loss-light)] text-[var(--loss)]"
                          )}>{isEfficient ? '✓ EFFICIENT' : '⚠ OVER'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ TAB: DAILY PACING ═══════════ */}
      {activeTab === 'pacing' && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--primary)]" />
            Daily Pacing History (Last 14 Days)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-tertiary)] uppercase font-bold tracking-wider">
                  <th className="pb-2.5">Date</th>
                  <th className="pb-2.5 text-right">Target Leads</th>
                  <th className="pb-2.5 text-right">Actual Leads</th>
                  <th className="pb-2.5 text-right">Target KYC</th>
                  <th className="pb-2.5 text-right">Actual KYC</th>
                  <th className="pb-2.5 text-right">Target Act.</th>
                  <th className="pb-2.5 text-right">Actual Act.</th>
                  <th className="pb-2.5 text-right">Cumulative</th>
                  <th className="pb-2.5 text-right">Spend</th>
                  <th className="pb-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {state.pacing.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[var(--text-tertiary)]">
                      <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">No pacing data recorded yet</p>
                    </td>
                  </tr>
                ) : state.pacing.map((p: any, i: number) => {
                  const hitTarget = p.actual_activations >= p.target_activations;
                  return (
                    <tr key={i} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                      <td className="py-2.5 font-bold text-[var(--text-main)] tabular-nums">{p.pacing_date?.split('T')[0]}</td>
                      <td className="py-2.5 text-right text-[var(--text-tertiary)] tabular-nums">{p.target_leads}</td>
                      <td className="py-2.5 text-right font-bold text-[var(--text-main)] tabular-nums">{p.actual_leads}</td>
                      <td className="py-2.5 text-right text-[var(--text-tertiary)] tabular-nums">{p.target_kyc_completed}</td>
                      <td className="py-2.5 text-right font-bold text-[var(--text-main)] tabular-nums">{p.actual_kyc_completed}</td>
                      <td className="py-2.5 text-right text-[var(--text-tertiary)] tabular-nums">{p.target_activations}</td>
                      <td className={cls("py-2.5 text-right font-black tabular-nums", hitTarget ? "text-[var(--gain)]" : "text-[var(--loss)]")}>{p.actual_activations}</td>
                      <td className="py-2.5 text-right font-bold text-[var(--text-main)] tabular-nums">{p.cumulative_activations}</td>
                      <td className="py-2.5 text-right text-[var(--text-muted)] tabular-nums">{paisa(parseInt(p.actual_spend_paisa || '0'))}</td>
                      <td className="py-2.5 text-center">
                        <span className={cls("text-[9px] font-extrabold px-1.5 py-0.5 rounded",
                          p.status === 'AHEAD' ? "bg-[var(--gain-light)] text-[var(--gain)]" :
                          p.status === 'BEHIND' ? "bg-[var(--loss-light)] text-[var(--loss)]" :
                          "bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]"
                        )}>{p.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════ TAB: CREATORS & AFFILIATES ═══════════ */}
      {activeTab === 'creators' && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Instagram className="w-3.5 h-3.5 text-[var(--primary)]" />
            Creator & Micro-Influencer Partner Tracking
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-tertiary)] uppercase font-bold tracking-wider">
                  <th className="pb-2.5">Creator</th>
                  <th className="pb-2.5">Platform</th>
                  <th className="pb-2.5">Tier</th>
                  <th className="pb-2.5 text-right">Followers</th>
                  <th className="pb-2.5 text-right">Clicks</th>
                  <th className="pb-2.5 text-right">Leads</th>
                  <th className="pb-2.5 text-right">KYC Done</th>
                  <th className="pb-2.5 text-right">Activated</th>
                  <th className="pb-2.5 text-right">Conv %</th>
                  <th className="pb-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {state.creators.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[var(--text-tertiary)]">
                      <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">No creator partners registered yet</p>
                      <p className="text-[10px] mt-1">Register creators via POST /api/v1/warroom/creators</p>
                    </td>
                  </tr>
                ) : state.creators.map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                    <td className="py-2.5">
                      <div>
                        <span className="font-bold text-[var(--text-main)]">{c.name}</span>
                        <span className="text-[var(--text-tertiary)] ml-1.5">@{c.handle}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-[var(--text-muted)]">{c.platform}</td>
                    <td className="py-2.5"><span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[var(--gogrow-blue-light)] text-[var(--gogrow-blue)]">{c.tier}</span></td>
                    <td className="py-2.5 text-right text-[var(--text-muted)] tabular-nums">{parseInt(c.followers_count || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 text-right tabular-nums text-[var(--text-muted)]">{c.total_clicks}</td>
                    <td className="py-2.5 text-right tabular-nums font-bold text-[var(--text-main)]">{c.total_leads}</td>
                    <td className="py-2.5 text-right tabular-nums text-[var(--text-muted)]">{c.total_kyc_completed}</td>
                    <td className="py-2.5 text-right tabular-nums font-black text-[var(--primary)]">{c.total_activated}</td>
                    <td className="py-2.5 text-right tabular-nums text-[var(--text-muted)]">{c.total_leads > 0 ? ((c.total_activated / c.total_leads) * 100).toFixed(1) : '0.0'}%</td>
                    <td className="py-2.5 text-center">
                      <span className={cls("text-[9px] font-extrabold px-1.5 py-0.5 rounded",
                        c.is_active ? "bg-[var(--gain-light)] text-[var(--gain)]" : "bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)]"
                      )}>{c.is_active ? 'ACTIVE' : 'PAUSED'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════ TAB: 100 CONTENT SCRIPTS ═══════════ */}
      {activeTab === 'content' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Search hooks, scripts, captions..."
                value={contentFilter}
                onChange={e => setContentFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[11px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--primary)]/40"
              />
            </div>
            <select
              value={contentCategory}
              onChange={e => setContentCategory(e.target.value)}
              className="px-3 py-2 text-[11px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] font-bold focus:outline-none cursor-pointer"
            >
              <option value="">All Categories ({state.contentIdeas.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat} ({state.contentIdeas.filter((c: any) => c.category === cat).length})</option>
              ))}
            </select>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredContent.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 py-12 text-center text-[var(--text-tertiary)]">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-bold">No content scripts match your filter</p>
              </div>
            ) : filteredContent.map((c: any) => (
              <div key={c.idea_index} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-2.5 hover:shadow-md hover:border-[var(--primary)]/20 transition-all">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[var(--primary-light)] text-[var(--primary)]">
                    #{c.idea_index}
                  </span>
                  <div className="flex gap-1">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)]">{c.funnel_stage}</span>
                    <span className={cls("text-[8px] font-extrabold px-1.5 py-0.5 rounded",
                      c.publication_status === 'PUBLISHED' ? "bg-[var(--gain-light)] text-[var(--gain)]" : "bg-amber-50 text-amber-600"
                    )}>{c.publication_status}</span>
                  </div>
                </div>
                {/* Hook */}
                <p className="text-[12px] font-black text-[var(--text-main)] leading-snug line-clamp-2">"{c.hook}"</p>
                {/* Category & Audience */}
                <div className="flex items-center gap-2 text-[9px] text-[var(--text-tertiary)] font-bold">
                  <span className="px-1.5 py-0.5 rounded bg-[var(--gogrow-blue-light)] text-[var(--gogrow-blue)]">{c.category}</span>
                  <span>→ {c.target_audience}</span>
                </div>
                {/* Script Preview */}
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed line-clamp-3">{c.script_body}</p>
                {/* CTA */}
                <div className="pt-2 border-t border-[var(--border-light)] flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[var(--primary)]">{c.call_to_action}</span>
                  <Eye className="w-3 h-3 text-[var(--text-tertiary)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: WHATSAPP AUTOMATION ═══════════ */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-5">
          {/* Gateway Health & Pairing Banner */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cls("w-3 h-3 rounded-full shrink-0",
                waStatus?.connection?.state === 'open' ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-amber-500"
              )} />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-[var(--text-main)] uppercase tracking-wider">
                    WhatsApp Gateway: {waStatus?.connection?.state === 'open' ? 'CONNECTED & ACTIVE' : `AWAITING PAIRING (${waStatus?.connection?.state || 'CONNECTING'})`}
                  </h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] font-mono">
                    Instance: {waStatus?.connection?.instance || 'shreesvarn'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Daily Warm-Up: <b className="text-[var(--text-main)]">{waStatus?.messagesSentToday ?? 0}</b> / {waStatus?.dailyWarmupLimit ?? 60} messages sent today ({waStatus?.warmupRemaining ?? 60} remaining) • Anti-Ban Jitter: Active (3.5s - 7.5s)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/api/v1/warroom/whatsapp/qr?format=html"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[var(--primary)] text-black hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Pair Device (QR)
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
              <button
                type="button"
                onClick={fetchAll}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-light)] text-[var(--text-muted)] transition-colors"
                title="Refresh Status"
              >
                <RefreshCw className={cls("w-3.5 h-3.5", refreshing && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Interactive Dispatcher: Send WhatsApp Message to Client */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4 text-[var(--primary)]" />
                Send WhatsApp Message to Client
              </h3>
              <span className="text-[10px] text-[var(--text-tertiary)]">Spintax & Anti-Ban Protection Enabled</span>
            </div>

            <form onSubmit={handleSendWa} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Client Phone Number */}
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase mb-1">
                    Client Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-[11px] font-mono text-[var(--text-tertiary)]">+91</span>
                    <input
                      type="text"
                      placeholder="9876543210"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      className="w-full pl-11 pr-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Client Name */}
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase mb-1">
                    Client Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rohit Sharma"
                    value={waName}
                    onChange={(e) => setWaName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                {/* Sequence Template */}
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase mb-1">
                    Message Type / Sequence
                  </label>
                  <select
                    value={waSequence}
                    onChange={(e) => setWaSequence(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="CUSTOM">⚡ Custom Message / Quick Text</option>
                    <option value="LEAD_WELCOME">🎯 1. Lead Welcome & KYC Link</option>
                    <option value="KYC_NUDGE">⏳ 2. KYC Abandonment Rescue Nudge</option>
                    <option value="ACTIVATION">🚀 3. Account Approved Activation</option>
                    <option value="FIRST_TRADE">🎉 4. First Trade Celebration</option>
                  </select>
                </div>
              </div>

              {/* Custom Text Area (shown when CUSTOM sequence is selected) */}
              {waSequence === 'CUSTOM' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase">
                      Custom Message Body
                    </label>
                    <span className="text-[10px] text-[var(--text-tertiary)]">Tip: Use {"{Namaste|Hello|Dear}"} for anti-fingerprint rotation</span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="{Namaste|Hello} Rohit! Your requested market analysis report is now available on TradeGrow..."
                    value={waText}
                    onChange={(e) => setWaText(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-[var(--border-light)] bg-[var(--bg-surface-elevated)] text-[11px] text-[var(--text-muted)]">
                  <span className="font-bold text-[var(--text-main)]">Preset Journey Preview: </span>
                  {waSequence === 'LEAD_WELCOME' && `"{Namaste|Hello} ${waName || 'Trader'}! Welcome to Trade Grow. Your paperless demat application is ready: https://tradegrowx.in/kyc... Reply STOP to unsubscribe."`}
                  {waSequence === 'KYC_NUDGE' && `"{Your application is waiting|Quick update}: Your Trade Grow KYC is pending. Pick up right where you left off in under 60 seconds with DigiLocker... Reply STOP to opt out."`}
                  {waSequence === 'ACTIVATION' && `"{Congratulations|Great news} ${waName || 'Trader'}! Your Trade Grow account has been VERIFIED and APPROVED. Log in now to access real-time option chains: https://tradegrowx.in/terminal"`}
                  {waSequence === 'FIRST_TRADE' && `"🎉 Trade Confirmed! You are officially Founding Member of the Trade Grow Active Traders Club! Inspect your contract note: https://tradegrowx.in/positions"`}
                </div>
              )}

              {/* Status Banner */}
              {waResult && (
                <div className={cls("p-3 rounded-lg text-xs font-semibold",
                  waResult.success ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                )}>
                  {waResult.message}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 inline" />
                  Typing emulation, rate limiters, and opt-out listeners applied automatically
                </span>
                <button
                  type="submit"
                  disabled={waSending}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--primary)] text-black hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                >
                  <Send className={cls("w-3.5 h-3.5", waSending && "animate-spin")} />
                  {waSending ? 'Simulating Typing & Sending...' : 'Send WhatsApp Message'}
                </button>
              </div>
            </form>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Messages" value={state.whatsappMessages.length} icon={<Send className="w-3.5 h-3.5" />} sub="Across all sequences" />
            <StatCard label="Outbound" value={state.whatsappMessages.filter((m: any) => m.direction === 'OUTBOUND').length} icon={<ArrowUpRight className="w-3.5 h-3.5" />} sub="Automated sends" />
            <StatCard label="Delivered" value={state.whatsappMessages.filter((m: any) => m.status === 'DELIVERED' || m.delivered_at).length} icon={<CheckCircle2 className="w-3.5 h-3.5" />} sub="Confirmed delivery" />
            <StatCard label="Read" value={state.whatsappMessages.filter((m: any) => m.read_at).length} icon={<Eye className="w-3.5 h-3.5" />} sub="Blue ticks received" />
          </div>

          {/* Message Ledger */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3">
            <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5 text-[var(--primary)]" />
              WhatsApp Message Ledger (Last 30)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-tertiary)] uppercase font-bold tracking-wider">
                    <th className="pb-2.5">Phone</th>
                    <th className="pb-2.5">Template</th>
                    <th className="pb-2.5">Direction</th>
                    <th className="pb-2.5">Provider</th>
                    <th className="pb-2.5 text-center">Status</th>
                    <th className="pb-2.5 text-right">Sent</th>
                    <th className="pb-2.5 text-right">Delivered</th>
                    <th className="pb-2.5 text-right">Read</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {state.whatsappMessages.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[var(--text-tertiary)]">
                        <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">No WhatsApp messages sent yet</p>
                        <p className="text-[10px] mt-1">Messages trigger automatically on lead ingestion and activation events</p>
                      </td>
                    </tr>
                  ) : state.whatsappMessages.map((m: any, i: number) => (
                    <tr key={i} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                      <td className="py-2 font-mono text-[var(--text-main)] font-bold">{m.phone_e164}</td>
                      <td className="py-2 text-[var(--text-muted)]">{m.template_name}</td>
                      <td className="py-2">
                        <span className={cls("text-[9px] font-extrabold px-1.5 py-0.5 rounded",
                          m.direction === 'OUTBOUND' ? "bg-[var(--gogrow-blue-light)] text-[var(--gogrow-blue)]" : "bg-[var(--primary-light)] text-[var(--primary)]"
                        )}>{m.direction}</span>
                      </td>
                      <td className="py-2 text-[var(--text-tertiary)]">{m.provider}</td>
                      <td className="py-2 text-center">
                        <span className={cls("text-[9px] font-extrabold px-1.5 py-0.5 rounded",
                          m.status === 'SENT' || m.status === 'DELIVERED' ? "bg-[var(--gain-light)] text-[var(--gain)]" :
                          m.status === 'FAILED' ? "bg-[var(--loss-light)] text-[var(--loss)]" :
                          "bg-amber-50 text-amber-600"
                        )}>{m.status}</span>
                      </td>
                      <td className="py-2 text-right text-[var(--text-tertiary)] tabular-nums">{m.sent_at ? new Date(m.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="py-2 text-right text-[var(--text-tertiary)] tabular-nums">{m.delivered_at ? new Date(m.delivered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="py-2 text-right text-[var(--text-tertiary)] tabular-nums">{m.read_at ? new Date(m.read_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
