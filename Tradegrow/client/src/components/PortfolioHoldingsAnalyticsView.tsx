import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, PieChart, ShieldAlert, Zap, Layers, RefreshCw, AlertTriangle } from 'lucide-react';
import { Wallet } from '../types';
import { Card, CardHeader, CardTitle, Badge, DataTable, DataTableColumn, Button } from './ui';
import { PortfolioNav, PortfolioSection } from './PortfolioNav';
import { pnlColorClass, formatPnl, formatPnlPct } from '../utils/pnl';

interface PortfolioHoldingsAnalyticsViewProps {
  token: string;
  wallet: Wallet | null;
  riskRestriction?: string | null;
  onRefreshWallet?: () => void;
  initialTab?: 'HOLDINGS' | 'ANALYTICS';
}

interface RiskInfo {
  intradayLeverageMultiplier: number;
  misAutoSquareOffTime: string;
  misAutoSquareOffEnabled: boolean;
}

export const PortfolioHoldingsAnalyticsView: React.FC<PortfolioHoldingsAnalyticsViewProps> = ({
  token, wallet, riskRestriction, onRefreshWallet, initialTab = 'HOLDINGS',
}) => {
  const navigate = useNavigate();
  const activeTab = initialTab;
  const [holdings, setHoldings] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [riskInfo, setRiskInfo] = useState<RiskInfo>({ intradayLeverageMultiplier: 5, misAutoSquareOffTime: '15:15', misAutoSquareOffEnabled: true });
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    await Promise.allSettled([
      fetch('/api/v1/portfolio/holdings', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (data?.success && Array.isArray(data.holdings)) setHoldings(data.holdings); }),
      fetch('/api/v1/portfolio/positions?todayOnly=true', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (data?.success && Array.isArray(data.positions)) setPositions(data.positions); }),
      fetch('/api/v1/risk-info', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (data?.success && data.riskInfo) setRiskInfo(data.riskInfo); }),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const investedValue = holdings.reduce((acc, h) => acc + h.quantity * h.averagePrice, 0);
  const currentValue = holdings.reduce((acc, h) => acc + h.currentValue, 0);
  const holdingsPnl = holdings.reduce((acc, h) => acc + h.pnl, 0);
  const holdingsPnlPct = investedValue > 0 ? (holdingsPnl / investedValue) * 100 : 0;

  const cashBalance = wallet?.cashBalance || 0;
  const usedMargin = wallet?.usedMargin || 0;
  const buyingPower = wallet?.buyingPower ?? cashBalance;
  const realizedPnl = wallet?.realizedPnl || 0;
  const unrealizedPnl = wallet?.unrealizedPnl || 0;
  const totalPortfolioValue = cashBalance + unrealizedPnl + currentValue;
  const marginPct = cashBalance > 0 ? Math.min(100, (usedMargin / cashBalance) * 100) : 0;

  // Real allocation, replacing the old view's hardcoded 45/30/25% bars — each
  // slice comes from data already on the page (open non-delivery positions,
  // delivery holdings, remaining cash), not a static mockup number.
  const derivativeExposure = positions
    .filter((p) => (p.productType || p.product_type) !== 'CNC')
    .reduce((acc, p) => acc + Math.abs(parseInt(p.netQty ?? p.net_qty ?? 0, 10)) * parseFloat(p.ltp || p.averagePrice || p.average_price || 0), 0);
  const allocationTotal = Math.max(cashBalance + currentValue + derivativeExposure, 1);
  const allocation = [
    { label: 'Delivery Holdings (CNC)', value: currentValue, pct: (currentValue / allocationTotal) * 100, color: 'bg-[var(--gain)]' },
    { label: 'Intraday / F&O Exposure', value: derivativeExposure, pct: (derivativeExposure / allocationTotal) * 100, color: 'bg-[var(--info)]' },
    { label: 'Unallocated Cash', value: cashBalance, pct: (cashBalance / allocationTotal) * 100, color: 'bg-[var(--warning)]' },
  ];

  const holdingColumns: DataTableColumn<any>[] = [
    { key: 'symbol', header: 'Instrument', mobilePrimary: true, render: (h) => (
      <div className="flex items-center gap-2">
        <span className="font-bold text-[var(--text-main)]">{h.symbol}</span>
        <Badge variant="neutral">{h.exchange}</Badge>
      </div>
    ) },
    { key: 'quantity', header: 'Qty', render: (h) => <span className="num-font">{h.quantity}</span> },
    { key: 'averagePrice', header: 'Avg Price', mobileHidden: true, render: (h) => <span className="num-font">₹{h.averagePrice.toFixed(2)}</span> },
    { key: 'ltp', header: 'LTP', render: (h) => <span className="num-font">₹{h.ltp.toFixed(2)}</span> },
    { key: 'currentValue', header: 'Current Value', mobileHidden: true, render: (h) => <span className="num-font">₹{h.currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> },
    { key: 'pnl', header: 'P&L', render: (h) => (
      <span className={`num-font font-bold ${h.pnl >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
        {h.pnl >= 0 ? '+' : ''}₹{h.pnl.toFixed(2)} ({h.pnlPercentage >= 0 ? '+' : ''}{h.pnlPercentage.toFixed(2)}%)
      </span>
    ) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PortfolioNav active={activeTab as PortfolioSection} counts={{ HOLDINGS: holdings.length }} />
        <Button variant="secondary" size="sm" leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />} onClick={() => { fetchData(); onRefreshWallet?.(); }}>
          Refresh
        </Button>
      </div>

      {activeTab === 'HOLDINGS' && (
        <>
          <Card>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 num-font">
              <div>
                <div className="text-xs font-bold text-[var(--text-muted)] mb-1">Invested Value</div>
                <div className="text-lg font-black text-[var(--text-main)]">₹{investedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--text-muted)] mb-1">Current Value</div>
                <div className="text-lg font-black text-[var(--text-main)]">₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--text-muted)] mb-1">Total P&L</div>
                <div className={`text-lg font-black ${pnlColorClass(holdingsPnl)}`}>{formatPnl(holdingsPnl)}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--text-muted)] mb-1">Returns</div>
                <div className={`text-lg font-black ${pnlColorClass(holdingsPnlPct)}`}>{formatPnlPct(holdingsPnlPct)}</div>
              </div>
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="p-3">
              <DataTable
                columns={holdingColumns}
                rows={holdings}
                rowKey={(h) => h.id || h.symbol}
                isLoading={loading && holdings.length === 0}
                emptyIcon={<WalletIcon className="w-5 h-5" />}
                emptyTitle="No delivery holdings yet"
                emptyMessage="Stocks you buy with the CNC product type settle into long-term holdings and appear here."
                emptyAction={<Button size="sm" onClick={() => navigate('/')}>Browse stocks</Button>}
              />
            </div>
          </Card>
        </>
      )}

      {activeTab === 'ANALYTICS' && (
        <>
          {riskRestriction === 'REDUCE_ONLY' && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-light)]">
              <AlertTriangle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-[var(--warning)]">Account Restricted — Reduce-Only</div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Your account is currently <strong>restricted to reduce-only trading pending risk review</strong>. You can still close or reduce existing positions, but new or exposure-increasing orders will be rejected until a risk review clears this restriction.
                </p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)]">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Portfolio & Risk Analytics</CardTitle>
                  <span className="text-xs text-[var(--text-muted)]">Comprehensive risk assessment, margin utilization, and P&L breakdown</span>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Portfolio Value</span>
                <WalletIcon className="w-4 h-4 text-[var(--gain)]" />
              </div>
              <span className="text-xl font-black num-font text-[var(--text-main)]">₹{totalPortfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <div className="text-[10px] text-[var(--text-muted)] mt-1 num-font">CASH + UNREALIZED P&L + HOLDINGS VALUE</div>
            </Card>
            <Card>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Available Buying Power</span>
                <Zap className="w-4 h-4 text-[var(--info)]" />
              </div>
              <span className="text-xl font-black num-font text-[var(--gain)]">₹{buyingPower.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <div className="text-[10px] text-[var(--text-muted)] mt-1 num-font">CASH MINUS BLOCKED MARGIN</div>
            </Card>
            <Card>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Blocked Margin</span>
                <ShieldAlert className="w-4 h-4 text-[var(--warning)]" />
              </div>
              <span className="text-xl font-black num-font text-[var(--warning)]">₹{usedMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <div className="text-[10px] text-[var(--text-muted)] mt-1 num-font">UTILIZATION: {marginPct.toFixed(1)}%</div>
            </Card>
            <Card>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Combined P&L</span>
                {(realizedPnl + unrealizedPnl) >= 0 ? <TrendingUp className="w-4 h-4 text-[var(--gain)]" /> : <TrendingDown className="w-4 h-4 text-[var(--loss)]" />}
              </div>
              <span className={`text-xl font-black num-font ${(realizedPnl + unrealizedPnl) >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                {(realizedPnl + unrealizedPnl) >= 0 ? '+' : ''}₹{(realizedPnl + unrealizedPnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <div className="text-[10px] text-[var(--text-muted)] mt-1 num-font">REALIZED: ₹{realizedPnl.toFixed(2)} | UNREALIZED: ₹{unrealizedPnl.toFixed(2)}</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Card className="lg:col-span-7">
              <CardTitle className="mb-4 pb-3 border-b border-[var(--border-color)] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[var(--warning)]" /> Margin & Risk Utilization Meter
              </CardTitle>
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-[var(--text-muted)]">Current Margin Usage Ratio:</span>
                    <span className="num-font font-bold text-[var(--warning)]">{marginPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-4 w-full bg-[var(--bg-surface-inset)] rounded-full border border-[var(--border-color)] overflow-hidden flex">
                    <div className="bg-[var(--warning)] h-full transition-all duration-500" style={{ width: `${marginPct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs num-font bg-[var(--bg-surface-inset)] p-4 rounded-xl border border-[var(--border-color)]">
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">MAX INTRADAY LEVERAGE</span>
                    <span className="font-bold text-[var(--text-main)] text-sm">{riskInfo.intradayLeverageMultiplier.toFixed(1)}x (MIS)</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">DELIVERY MARGIN</span>
                    <span className="font-bold text-[var(--text-main)] text-sm">1.0x (CNC)</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">AUTO SQUARE-OFF CUTOFF</span>
                    <span className={`font-bold text-sm ${riskInfo.misAutoSquareOffEnabled ? 'text-[var(--loss)]' : 'text-[var(--text-muted)]'}`}>
                      {riskInfo.misAutoSquareOffEnabled ? `${riskInfo.misAutoSquareOffTime} IST` : 'Disabled'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">RISK STATUS</span>
                    <span className={`font-bold text-sm ${riskRestriction === 'REDUCE_ONLY' ? 'text-[var(--warning)]' : 'text-[var(--gain)]'}`}>
                      {riskRestriction === 'REDUCE_ONLY' ? 'Reduce-Only' : 'Normal'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-5">
              <CardTitle className="mb-4 pb-3 border-b border-[var(--border-color)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--info)]" /> Capital Asset Allocation
              </CardTitle>
              <div className="flex flex-col gap-3 text-xs">
                {allocation.map((a) => (
                  <div key={a.label}>
                    <div className="flex justify-between font-semibold mb-1">
                      <span className="text-[var(--text-main)]">{a.label}</span>
                      <span className="num-font text-[var(--text-muted)]">{a.pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-[var(--bg-surface-inset)] rounded-full overflow-hidden">
                      <div className={`${a.color} h-full transition-all duration-500`} style={{ width: `${Math.min(100, a.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 30-Day P&L Calendar Heatmap */}
            <Card className="lg:col-span-12">
              <CardTitle className="mb-3 pb-2 border-b border-[var(--border-color)] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--gain)]" /> 30-Day Trading Performance Heatmap
                </span>
                <span className="text-xs text-[var(--text-muted)] font-normal">Daily Trading P&L Distribution</span>
              </CardTitle>
              <div className="space-y-3">
                <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 gap-1.5 pt-1">
                  {Array.from({ length: 30 }).map((_, idx) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (29 - idx));
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isToday = idx === 29;
                    const dayPnl = isToday ? (realizedPnl + unrealizedPnl) : null;
                    const isPos = dayPnl !== null && dayPnl > 0;
                    const isNeg = dayPnl !== null && dayPnl < 0;

                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-between min-h-[52px] ${
                          isWeekend
                            ? 'bg-[var(--bg-surface-inset)]/40 border-transparent opacity-40'
                            : isToday && isPos
                            ? 'bg-[var(--gain)]/15 border-[var(--gain)] text-[var(--gain)]'
                            : isToday && isNeg
                            ? 'bg-[var(--loss)]/15 border-[var(--loss)] text-[var(--loss)]'
                            : 'bg-[var(--bg-surface-inset)] border-[var(--border-color)]'
                        }`}
                        title={`${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}: ${isWeekend ? 'Market Closed' : dayPnl !== null ? `₹${dayPnl.toFixed(2)}` : 'Flat / Active'}`}
                      >
                        <span className="text-[9px] font-bold text-[var(--text-muted)]">
                          {d.toLocaleDateString('en-IN', { month: 'numeric', day: 'numeric' })}
                        </span>
                        {isWeekend ? (
                          <span className="text-[8px] text-[var(--text-muted)]">—</span>
                        ) : dayPnl !== null && dayPnl !== 0 ? (
                          <span className={`text-[10px] font-mono font-black ${isPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                            {isPos ? '+' : ''}₹{Math.abs(dayPnl) >= 1000 ? `${(dayPnl / 1000).toFixed(1)}k` : dayPnl.toFixed(0)}
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]/40 mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-end gap-3 text-[10px] text-[var(--text-muted)] pt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[var(--gain)]/20 border border-[var(--gain)]" /> Profit Day</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[var(--loss)]/20 border border-[var(--loss)]" /> Loss Day</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[var(--bg-surface-inset)] border border-[var(--border-color)]" /> Flat / No Trades</span>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
