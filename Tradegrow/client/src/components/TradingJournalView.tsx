import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Award,
  Clock,
  DollarSign,
  BarChart3,
  Percent,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  Sparkles,
  PiggyBank,
  ShieldCheck,
  Tag,
  MessageSquare,
  Edit3,
  X,
  Check,
  FileText,
} from 'lucide-react';
import { Card, Badge, Button } from './ui';
import { PortfolioNav } from './PortfolioNav';
import { pnlColorClass, formatPnl } from '../utils/pnl';
import { ContractNoteModal } from './ContractNoteModal';

export interface TradeMeta {
  tag?: string;
  notes?: string;
}

export const STRATEGY_TAGS = [
  { id: 'BREAKOUT', label: 'Breakout', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  { id: 'SCALP', label: 'Scalp', color: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  { id: 'REVERSAL', label: 'Reversal', color: 'bg-purple-500/15 text-purple-500 border-purple-500/30' },
  { id: 'MOMENTUM', label: 'Momentum', color: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  { id: 'MISTAKE', label: 'Mistake / FOMO', color: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
];

interface DailyPnl {
  date: string;
  netPnl: number;
  tradeCount: number;
}

interface SymbolStat {
  symbol: string;
  pnl: number;
  trades: number;
}

interface HourlyStat {
  hour: number;
  pnl: number;
  trades: number;
}

interface JournalSavings {
  totalSaved: number;
  brokerageSaved: number;
  statutorySaved: number;
  tradeGrowCost: number;
  tradesCount: number;
}

interface JournalMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRatePct: number;
  profitFactor: number;
  riskRewardRatio: number;
  totalGrossPnl: number;
  totalCharges: number;
  totalNetPnl: number;
  bestSymbol: string | null;
  bestSymbolPnl: number;
  bestHour: number | null;
  bestHourPnl: number;
  averageWin: number;
  averageLoss: number;
  dailyPnlMap: Record<string, DailyPnl>;
  symbolStats: SymbolStat[];
  hourlyStats: HourlyStat[];
  savings?: JournalSavings;
}

interface ClosedTrade {
  id: string;
  symbol: string;
  exchange: string;
  productType: string;
  entrySide: string;
  exitSide: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  charges: number;
  netPnl: number;
  exitReason: string;
  closedAt: string;
  estimatedSavings?: number;
  brokerageSaved?: number;
  statutorySaved?: number;
}

interface TradingJournalViewProps {
  token: string;
}

export const TradingJournalView: React.FC<TradingJournalViewProps> = ({ token }) => {
  const [days, setDays] = useState<number>(90);
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<JournalMetrics | null>(null);
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [selectedStrategyFilter, setSelectedStrategyFilter] = useState<string>('ALL');
  const [editingTradeNote, setEditingTradeNote] = useState<{ id: string; symbol: string; note: string } | null>(null);
  const [isContractNoteOpen, setIsContractNoteOpen] = useState(false);

  const [tradeMeta, setTradeMeta] = useState<Record<string, TradeMeta>>(() => {
    try {
      const saved = localStorage.getItem('tradegrow_journal_trade_meta');
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  const saveTradeMeta = (id: string, updates: Partial<TradeMeta>) => {
    setTradeMeta((prev) => {
      const updated = {
        ...prev,
        [id]: { ...(prev[id] || {}), ...updates },
      };
      try {
        localStorage.setItem('tradegrow_journal_trade_meta', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const fetchJournalData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/portfolio/trading-journal?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMetrics(data.metrics);
          setTrades(data.trades || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch trading journal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournalData();
  }, [token, days]);

  // Export Tax P&L Statement as CSV
  const handleExportCsv = () => {
    if (trades.length === 0) return;

    const headers = [
      'Trade ID',
      'Symbol',
      'Exchange',
      'Product Type',
      'Strategy',
      'Notes',
      'Entry Side',
      'Exit Side',
      'Quantity',
      'Entry Price',
      'Exit Price',
      'Gross P&L (₹)',
      'Charges (₹)',
      'Net Realized P&L (₹)',
      'Brokerage & Charges Saved (₹)',
      'Exit Reason',
      'Date & Time (IST)',
    ];

    const rows = trades.map((t) => [
      t.id,
      t.symbol,
      t.exchange,
      t.productType,
      tradeMeta[t.id]?.tag || 'UNTAGGED',
      `"${(tradeMeta[t.id]?.notes || '').replace(/"/g, '""')}"`,
      t.entrySide,
      t.exitSide,
      t.quantity,
      t.entryPrice.toFixed(2),
      t.exitPrice.toFixed(2),
      t.grossPnl.toFixed(2),
      t.charges.toFixed(2),
      t.netPnl.toFixed(2),
      (t.estimatedSavings ?? 40).toFixed(2),
      `"${t.exitReason || 'MANUAL'}"`,
      new Date(t.closedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `TradeGrow_Tax_PnL_Statement_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Statement (Formatted PDF view)
  const handlePrint = () => {
    window.print();
  };

  // Calendar calculations
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  const prevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };

  const monthName = currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Filter trades for selected day and selected strategy tag
  const displayedTrades = useMemo(() => {
    let list = trades;
    if (selectedDayDate) {
      list = list.filter((t) => t.closedAt.startsWith(selectedDayDate));
    }
    if (selectedStrategyFilter !== 'ALL') {
      list = list.filter((t) => {
        const metaTag = tradeMeta[t.id]?.tag;
        if (selectedStrategyFilter === 'UNTAGGED') return !metaTag;
        return metaTag === selectedStrategyFilter;
      });
    }
    return list;
  }, [trades, selectedDayDate, selectedStrategyFilter, tradeMeta]);

  // Monthly summary stats
  const monthlyStats = useMemo(() => {
    if (!metrics?.dailyPnlMap) return { totalPnl: 0, greenDays: 0, redDays: 0, tradingDays: 0 };
    let totalPnl = 0;
    let greenDays = 0;
    let redDays = 0;
    let tradingDays = 0;

    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    Object.entries(metrics.dailyPnlMap).forEach(([dateStr, d]) => {
      if (dateStr.startsWith(prefix) && d.tradeCount > 0) {
        tradingDays++;
        totalPnl += d.netPnl;
        if (d.netPnl > 0) greenDays++;
        else if (d.netPnl < 0) redDays++;
      }
    });

    return { totalPnl, greenDays, redDays, tradingDays };
  }, [metrics, year, month]);

  return (
    <div className="space-y-6">
      {/* Portfolio Navigation Header */}
      <PortfolioNav active="JOURNAL" />

      {/* Action Header & Date Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border-color)]">
        <div>
          <h1 className="text-xl font-black text-[var(--text-main)] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            Trading Journal & Tax Analytics
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Institutional performance diagnostics, win-rate analytics, risk:reward ratios & tax reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex items-center bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border-color)] text-xs font-bold">
            {[
              { label: '7D', value: 7 },
              { label: '30D', value: 30 },
              { label: '90D', value: 90 },
              { label: '365D', value: 365 },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setDays(item.value)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  days === item.value
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Button variant="secondary" size="sm" onClick={fetchJournalData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={trades.length === 0}>
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Export Tax P&L (CSV)</span>
          </Button>

          <Button variant="secondary" size="sm" onClick={() => setIsContractNoteOpen(true)}>
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Contract Note (ECN)</span>
          </Button>

          <Button variant="secondary" size="sm" onClick={handlePrint} disabled={trades.length === 0}>
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Print Statement</span>
          </Button>
        </div>
      </div>

      {/* ZERO-COST PLATFORM SAVINGS HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-[var(--bg-surface)] to-[var(--bg-surface)] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-base font-black text-[var(--text-main)] flex items-center gap-2">
                Brokerage &amp; Platform Charges Saved
              </h3>
              <Badge variant="gain" className="text-[10px] font-bold">
                ₹0 Flat Fee
              </Badge>
            </div>
            <p className="text-xs text-[var(--text-muted)] max-w-2xl">
              At TradeGrow, all equity delivery, intraday, and F&amp;O trades incur <span className="text-emerald-400 font-bold">₹0 brokerage</span> and zero platform taxes. Here is what you saved compared to standard discount brokers (₹20/order + STT + turnover taxes).
            </p>
          </div>

          {/* Big Stat Pill */}
          <div className="flex items-center gap-3 bg-[var(--bg-surface-elevated)]/80 border border-emerald-500/25 px-4 py-2.5 rounded-xl self-start lg:self-auto">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Total You Saved
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                ₹{(metrics?.savings?.totalSaved ?? ((metrics?.totalTrades || 0) * 40)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Micro Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[var(--border-color)]/60 text-xs">
          <div className="bg-[var(--bg-surface-elevated)]/40 p-2.5 rounded-xl border border-[var(--border-color)]/40">
            <span className="text-[10px] text-[var(--text-muted)] block">Brokerage Saved (₹20/order)</span>
            <span className="font-mono font-bold text-[var(--text-main)] text-sm">
              ₹{(metrics?.savings?.brokerageSaved ?? ((metrics?.totalTrades || 0) * 40)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-500 block mt-0.5">₹0 charged on TradeGrow</span>
          </div>
          <div className="bg-[var(--bg-surface-elevated)]/40 p-2.5 rounded-xl border border-[var(--border-color)]/40">
            <span className="text-[10px] text-[var(--text-muted)] block">Statutory &amp; STT Taxes Saved</span>
            <span className="font-mono font-bold text-[var(--text-main)] text-sm">
              ₹{(metrics?.savings?.statutorySaved ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Exchange, STT &amp; GST</span>
          </div>
          <div className="bg-[var(--bg-surface-elevated)]/40 p-2.5 rounded-xl border border-[var(--border-color)]/40">
            <span className="text-[10px] text-[var(--text-muted)] block">TradeGrow Cost</span>
            <span className="font-mono font-black text-emerald-400 text-sm">
              ₹0.00
            </span>
            <span className="text-[10px] text-emerald-400/80 block mt-0.5">100% Free Always</span>
          </div>
          <div className="bg-[var(--bg-surface-elevated)]/40 p-2.5 rounded-xl border border-[var(--border-color)]/40">
            <span className="text-[10px] text-[var(--text-muted)] block">Average Saved / Trade</span>
            <span className="font-mono font-bold text-indigo-400 text-sm">
              ₹{(metrics?.totalTrades ? ((metrics?.savings?.totalSaved ?? ((metrics?.totalTrades || 0) * 40)) / metrics.totalTrades) : 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Kept in your wallet</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Net Realized P&L */}
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Net Realized P&L
          </span>
          <div className="my-2">
            <span
              className={`text-lg sm:text-xl font-black font-mono ${pnlColorClass(
                metrics?.totalNetPnl || 0
              )}`}
            >
              {formatPnl(metrics?.totalNetPnl || 0)}
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] flex justify-between">
            <span>Gross: ₹{(metrics?.totalGrossPnl || 0).toFixed(2)}</span>
            <span>Chg: ₹{(metrics?.totalCharges || 0).toFixed(2)}</span>
          </div>
        </Card>

        {/* Win Rate */}
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
            Win Rate
            <Percent className="w-3 h-3 text-emerald-500" />
          </span>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-black font-mono text-[var(--text-main)]">
              {(metrics?.winRatePct || 0).toFixed(1)}%
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              ({metrics?.winningTrades || 0}W / {metrics?.losingTrades || 0}L)
            </span>
          </div>
          <div className="w-full bg-[var(--bg-surface-elevated)] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics?.winRatePct || 0)}%` }}
            />
          </div>
        </Card>

        {/* Profit Factor */}
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Profit Factor
          </span>
          <div className="my-2">
            <span className="text-lg sm:text-xl font-black font-mono text-[var(--text-main)]">
              {(metrics?.profitFactor || 0).toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {(metrics?.profitFactor || 0) >= 1.5 ? (
              <span className="text-emerald-500 font-bold">● High Edge</span>
            ) : (metrics?.profitFactor || 0) >= 1.0 ? (
              <span className="text-yellow-500 font-bold">● Moderate Edge</span>
            ) : (
              <span className="text-rose-500 font-bold">● Negative Edge</span>
            )}
          </div>
        </Card>

        {/* Risk : Reward */}
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Avg Risk : Reward
          </span>
          <div className="my-2">
            <span className="text-lg sm:text-xl font-black font-mono text-[var(--text-main)]">
              1 : {(metrics?.riskRewardRatio || 0).toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] flex justify-between">
            <span className="text-emerald-400">Avg W: ₹{(metrics?.averageWin || 0).toFixed(0)}</span>
            <span className="text-rose-400">Avg L: ₹{(metrics?.averageLoss || 0).toFixed(0)}</span>
          </div>
        </Card>

        {/* Best Instrument */}
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
            Top Symbol
            <Award className="w-3 h-3 text-amber-400" />
          </span>
          <div className="my-2 truncate">
            <span className="text-sm font-black text-[var(--text-main)] block truncate">
              {metrics?.bestSymbol || '—'}
            </span>
          </div>
          <div className="text-[10px] text-emerald-500 font-bold font-mono">
            {metrics?.bestSymbolPnl ? `+₹${metrics.bestSymbolPnl.toFixed(2)}` : '—'}
          </div>
        </Card>

        {/* Best Trading Hour */}
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
            Prime Hour
            <Clock className="w-3 h-3 text-blue-400" />
          </span>
          <div className="my-2">
            <span className="text-sm font-black text-[var(--text-main)]">
              {metrics?.bestHour !== null && metrics?.bestHour !== undefined
                ? `${metrics.bestHour}:00 - ${metrics.bestHour + 1}:00`
                : '—'}
            </span>
          </div>
          <div className="text-[10px] text-emerald-500 font-bold font-mono">
            {metrics?.bestHourPnl ? `+₹${metrics.bestHourPnl.toFixed(2)}` : '—'}
          </div>
        </Card>
      </div>

      {/* Main Two-Column Layout: Heatmap Calendar & Stats Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Heatmap (7 cols on lg) */}
        <div className="lg:col-span-7 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-extrabold text-[var(--text-main)]">P&L Calendar Heatmap</h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-main)]">{monthName}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  className="p-1 rounded-lg bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-color)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextMonth}
                  className="p-1 rounded-lg bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-color)] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Month Summary Bar */}
          <div className="grid grid-cols-4 gap-2 mb-4 bg-[var(--bg-surface-elevated)] p-2.5 rounded-xl text-center text-xs">
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block">Month P&L</span>
              <span className={`font-black font-mono ${pnlColorClass(monthlyStats.totalPnl)}`}>
                {formatPnl(monthlyStats.totalPnl)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block">Trade Days</span>
              <span className="font-bold text-[var(--text-main)]">{monthlyStats.tradingDays}</span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block">Green Days</span>
              <span className="font-bold text-emerald-500">{monthlyStats.greenDays}</span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block">Red Days</span>
              <span className="font-bold text-rose-500">{monthlyStats.redDays}</span>
            </div>
          </div>

          {/* Calendar Grid Header */}
          <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5 text-[11px] font-bold text-[var(--text-muted)]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty offset padding for days before 1st of month */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="h-16 rounded-xl bg-transparent border border-transparent opacity-20" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayData = metrics?.dailyPnlMap?.[dateStr];
              const isSelected = selectedDayDate === dateStr;
              const isToday = new Date().toISOString().slice(0, 10) === dateStr;

              let bgClass = 'bg-[var(--bg-surface-elevated)]/40 hover:bg-[var(--bg-surface-elevated)] border-[var(--border-color)]/50';
              if (dayData && dayData.tradeCount > 0) {
                if (dayData.netPnl > 0) {
                  bgClass = 'bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25';
                } else if (dayData.netPnl < 0) {
                  bgClass = 'bg-rose-500/15 border-rose-500/30 hover:bg-rose-500/25';
                }
              }

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDayDate(isSelected ? null : dateStr)}
                  className={`h-16 p-1.5 rounded-xl border flex flex-col justify-between text-left transition-all ${bgClass} ${
                    isSelected ? 'ring-2 ring-emerald-500 border-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] font-bold ${isToday ? 'text-emerald-400 underline font-black' : 'text-[var(--text-muted)]'}`}>
                      {dayNum}
                    </span>
                    {dayData && dayData.tradeCount > 0 && (
                      <span className="text-[9px] px-1 rounded bg-[var(--bg-body)]/60 text-[var(--text-muted)] font-mono">
                        {dayData.tradeCount}T
                      </span>
                    )}
                  </div>

                  {dayData && dayData.tradeCount > 0 ? (
                    <div className="text-right">
                      <span
                        className={`text-[10px] font-mono font-black block truncate ${
                          dayData.netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {dayData.netPnl >= 0 ? '+' : ''}₹{Math.abs(dayData.netPnl).toFixed(0)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[9px] text-[var(--text-muted)]/30 text-right">—</span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDayDate && (
            <div className="mt-3 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-xs">
              <span className="text-emerald-400 font-bold">
                Filtered for {selectedDayDate} ({displayedTrades.length} trades)
              </span>
              <button
                onClick={() => setSelectedDayDate(null)}
                className="text-emerald-400 underline hover:text-emerald-300 font-bold text-[11px]"
              >
                Clear Filter
              </button>
            </div>
          )}
        </div>

        {/* Hourly & Symbol Breakdown (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Top Symbols */}
          <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)]">
            <h2 className="text-sm font-extrabold text-[var(--text-main)] mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Top Instruments by Performance
            </h2>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {metrics?.symbolStats && metrics.symbolStats.length > 0 ? (
                metrics.symbolStats.slice(0, 6).map((s) => (
                  <div
                    key={s.symbol}
                    className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs"
                  >
                    <div>
                      <span className="font-bold text-[var(--text-main)] block">{s.symbol}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{s.trades} trades</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-black ${pnlColorClass(s.pnl)}`}>
                        {formatPnl(s.pnl)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-[var(--text-muted)]">No instrument history found</div>
              )}
            </div>
          </div>

          {/* Hourly Breakdown */}
          <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)]">
            <h2 className="text-sm font-extrabold text-[var(--text-main)] mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Hourly Trading Edge (IST)
            </h2>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {metrics?.hourlyStats && metrics.hourlyStats.length > 0 ? (
                metrics.hourlyStats.map((h) => (
                  <div
                    key={h.hour}
                    className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs"
                  >
                    <div>
                      <span className="font-bold text-[var(--text-main)]">
                        {h.hour}:00 - {h.hour + 1}:00
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono ml-2">
                        ({h.trades} trades)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-black ${pnlColorClass(h.pnl)}`}>
                        {formatPnl(h.pnl)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-[var(--text-muted)]">No hourly data available</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Trade Book Table */}
      <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              Tax Statement & Trade Book ({displayedTrades.length} Closed Trades)
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              SEBI compliant audit records with strategy tags, trade psychology notes, and net profit.
            </p>
          </div>

          {/* Strategy Tag Filters */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedStrategyFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                selectedStrategyFilter === 'ALL'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              All Strategies
            </button>
            {STRATEGY_TAGS.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStrategyFilter(st.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                  selectedStrategyFilter === st.id
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {st.label}
              </button>
            ))}
            <button
              onClick={() => setSelectedStrategyFilter('UNTAGGED')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                selectedStrategyFilter === 'UNTAGGED'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Untagged
            </button>
          </div>
        </div>

        {displayedTrades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] font-bold">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Strategy</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Entry (₹)</th>
                  <th className="py-2.5 px-3 text-right">Exit (₹)</th>
                  <th className="py-2.5 px-3 text-right">Gross P&L</th>
                  <th className="py-2.5 px-3 text-right">Net P&L</th>
                  <th className="py-2.5 px-3 text-right text-emerald-400">Saved (₹)</th>
                  <th className="py-2.5 px-3">Exit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]/40 font-mono">
                {displayedTrades.map((t) => {
                  const currentTag = tradeMeta[t.id]?.tag;
                  const currentNote = tradeMeta[t.id]?.notes;

                  return (
                    <tr key={t.id} className="hover:bg-[var(--bg-surface-elevated)]/50 transition-colors">
                      <td className="py-2.5 px-3 text-[var(--text-muted)] font-sans text-[11px] whitespace-nowrap">
                        {new Date(t.closedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(t.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-[var(--text-main)] whitespace-nowrap">
                        {t.symbol}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[10px] font-bold border border-[var(--border-color)]">
                          {t.productType}
                        </span>
                      </td>

                      {/* Strategy Tag Selector */}
                      <td className="py-2.5 px-3 font-sans">
                        <select
                          value={currentTag || ''}
                          onChange={(e) => saveTradeMeta(t.id, { tag: e.target.value || undefined })}
                          className={`text-[10px] font-bold py-1 px-2 rounded-lg border focus:outline-none cursor-pointer transition-colors ${
                            STRATEGY_TAGS.find((st) => st.id === currentTag)?.color ||
                            'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)]'
                          }`}
                        >
                          <option value="">Tag Setup...</option>
                          {STRATEGY_TAGS.map((st) => (
                            <option key={st.id} value={st.id} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Notes Trigger */}
                      <td className="py-2.5 px-3 font-sans">
                        <button
                          onClick={() => setEditingTradeNote({ id: t.id, symbol: t.symbol, note: currentNote || '' })}
                          className={`flex items-center gap-1 text-[11px] py-1 px-2 rounded-lg transition-colors border ${
                            currentNote
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-transparent hover:border-[var(--border-color)]'
                          }`}
                          title={currentNote || 'Add trade note'}
                        >
                          <MessageSquare className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[90px]">
                            {currentNote || 'Add note'}
                          </span>
                        </button>
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded whitespace-nowrap ${
                            t.entrySide === 'BUY'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          {t.entrySide} ➔ {t.exitSide}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--text-main)]">{t.quantity}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">₹{t.entryPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">₹{t.exitPrice.toFixed(2)}</td>
                      <td className={`py-2.5 px-3 text-right whitespace-nowrap ${pnlColorClass(t.grossPnl)}`}>
                        {formatPnl(t.grossPnl)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${pnlColorClass(t.netPnl)}`}>
                        {formatPnl(t.netPnl)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">
                        +₹{(t.estimatedSavings ?? 40).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                        {t.exitReason || 'MANUAL_EXIT'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-xs text-[var(--text-muted)]">
            No closed trades found for the selected timeframe / filter.
          </div>
        )}
      </div>

      {/* Trade Note Edit Modal */}
      {editingTradeNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  Trade Notes: {editingTradeNote.symbol}
                </h3>
              </div>
              <button
                onClick={() => setEditingTradeNote(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={4}
              value={editingTradeNote.note}
              onChange={(e) => setEditingTradeNote({ ...editingTradeNote, note: e.target.value })}
              placeholder="Why did you take this trade? Any emotion, mistake, or setup observation?"
              className="w-full p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
            />

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingTradeNote(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  saveTradeMeta(editingTradeNote.id, { notes: editingTradeNote.note });
                  setEditingTradeNote(null);
                }}
              >
                Save Notes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Electronic Contract Note (ECN) Modal */}
      <ContractNoteModal
        isOpen={isContractNoteOpen}
        onClose={() => setIsContractNoteOpen(false)}
        token={token}
        defaultDate={selectedDayDate || undefined}
      />
    </div>
  );
};
