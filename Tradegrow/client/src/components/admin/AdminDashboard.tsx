import React, { useState, useEffect } from 'react';
import {
  Users, TrendingUp, DollarSign, ShieldAlert, Activity, BarChart3,
  ArrowUpRight, ArrowDownRight, Zap, Database, Wifi, Server, RefreshCw,
  AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { ActivePositionsModal } from './ActivePositionsModal';

interface AdminDashboardProps {
  token: string;
  onNavigate?: (page: any, filter?: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ token, onNavigate }) => {
  const [kpis, setKpis] = useState<any>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showActivePositionsModal, setShowActivePositionsModal] = useState(false);

  const fetchKpis = () => {
    setIsRefreshing(true);
    fetch('/api/v1/admin/dashboard/executive', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const payload = d.kpis || d.data;
        if (d.success && payload) {
          setKpis({
            customers: {
              total: payload.customers?.total ?? 0,
              active: payload.customers?.active ?? 0,
              new: payload.customers?.new ?? payload.customers?.newLast30Days ?? 0,
              kycPending: payload.customers?.kycPending ?? 0,
              kycRejected: payload.customers?.kycRejected ?? 0,
              suspended: payload.customers?.suspended ?? 0,
              frozen: payload.customers?.frozen ?? 0,
            },
            trading: {
              ordersToday: payload.trading?.ordersToday ?? 0,
              tradesToday: payload.trading?.tradesToday ?? 0,
              turnover: payload.trading?.turnover ?? payload.trading?.totalTurnover ?? 0,
              buyValue: payload.trading?.buyValue ?? payload.trading?.buyTurnover ?? 0,
              sellValue: payload.trading?.sellValue ?? payload.trading?.sellTurnover ?? 0,
              activeTraders: payload.trading?.activeTraders ?? payload.trading?.activeTradersToday ?? 0,
            },
            financial: {
              totalFunds: payload.financial?.totalFunds ?? payload.financials?.totalFundsUnderCustody ?? 0,
              marginUtilized: payload.financial?.marginUtilized ?? payload.financials?.totalMarginUtilized ?? 0,
              brokerage: payload.financial?.brokerage ?? payload.financials?.totalBrokerageEarned ?? 0,
              pendingWithdrawals: payload.financial?.pendingWithdrawals ?? payload.financials?.pendingWithdrawalsCount ?? 0,
            },
            risk: {
              highRiskClients: payload.risk?.highRiskClients ?? payload.risk?.highRiskEvents ?? 0,
              marginAlerts: payload.risk?.marginAlerts ?? 0,
              rmsBlocks: payload.risk?.rmsBlocks ?? 0,
              frozenAccounts: payload.risk?.frozenAccounts ?? payload.customers?.frozen ?? 0,
            },
            technology: {
              apiStatus: payload.technology?.apiStatus ?? 'OPERATIONAL',
              wsStatus: payload.technology?.wsStatus ?? 'CONNECTED',
              brokerStatus: payload.technology?.brokerStatus ?? payload.system?.marketDataProvider ?? 'LIVE',
              marketDataStatus: payload.technology?.marketDataStatus ?? 'LIVE',
              omsStatus: payload.technology?.omsStatus ?? 'OPERATIONAL',
              rmsStatus: payload.technology?.rmsStatus ?? 'ACTIVE',
              databaseHealth: payload.technology?.databaseHealth ?? (payload.system?.databaseHealthy ? 'HEALTHY' : 'DEGRADED'),
            }
          });
        }
        setLastRefreshed(new Date());
      })
      .catch((err) => {
        console.error('Failed to fetch admin executive dashboard KPIs:', err);
      })
      .finally(() => setIsRefreshing(false));
  };

  useEffect(() => {
    fetchKpis();
    const interval = setInterval(fetchKpis, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (!kpis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[var(--text-muted)] gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--primary)]" />
        <span className="text-xs font-semibold tracking-wider uppercase">Loading Executive Command Dashboard...</span>
      </div>
    );
  }

  const StatusBadge = ({ status, label }: { status: string; label: string }) => {
    const isHealthy = ['OPERATIONAL', 'CONNECTED', 'LIVE', 'HEALTHY', 'ACTIVE'].includes(status?.toUpperCase());
    const isDegraded = ['DEGRADED', 'IDLE', 'WAITING', 'PENDING'].includes(status?.toUpperCase());

    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 hover:border-[var(--border-color)]/80 transition-all duration-200 group">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${
            isHealthy ? 'bg-[var(--primary)] shadow-[0_0_10px_rgba(52,211,153,0.5)]' :
            isDegraded ? 'bg-[var(--warning)] shadow-[0_0_10px_rgba(251,191,36,0.5)]' :
            'bg-[var(--loss)] shadow-[0_0_10px_rgba(248,113,113,0.5)]'
          } ${isHealthy ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-semibold text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors">{label}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
          isHealthy ? 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20' :
          isDegraded ? 'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20' :
          'bg-[var(--loss)]/10 text-[var(--loss)] border border-[var(--loss)]/20'
        }`}>
          {status}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1">

      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[var(--bg-surface)]/90 via-[var(--bg-surface)]/60 to-[var(--bg-surface)]/90 border border-[var(--border-color)]/90 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)]">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[var(--text-main)] tracking-tight flex items-center gap-2">
              EXECUTIVE COMMAND CENTER
              <span className="text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full border border-[var(--primary)]/20 uppercase tracking-widest">
                System Live
              </span>
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Multi-User Brokerage Operations & Risk Oversight Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 sm:mt-0">
          <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 bg-[var(--bg-body)]/60 px-3 py-1.5 rounded-lg border border-[var(--border-color)]">
            <Clock className="w-3 h-3 text-[var(--text-tertiary)]" />
            {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={fetchKpis}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-[var(--bg-surface-elevated)]/80 hover:bg-[var(--bg-surface-elevated)]/80 text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]/60 transition-all duration-200"
            title="Refresh KPIs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[var(--primary)]' : ''}`} />
          </button>
        </div>
      </div>

      {/* SECTION 1: CUSTOMER NETWORK */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--primary)]" /> Customer Network Overview
          </h3>
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">Total Clients: {kpis.customers.total.toLocaleString()}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Clients', value: kpis.customers.total, color: 'text-[var(--text-main)]', badge: 'All Accounts', onClick: () => onNavigate?.('CUSTOMERS', '') },
            { label: 'Active Clients', value: kpis.customers.active, color: 'text-[var(--primary)]', badge: 'View Positions →', onClick: () => setShowActivePositionsModal(true) },
            { label: 'New (30 Days)', value: kpis.customers.new, color: 'text-[var(--info)]', badge: 'Onboarded', onClick: () => onNavigate?.('CUSTOMERS', '') },
            { label: 'KYC Pending', value: kpis.customers.kycPending, color: 'text-[var(--warning)]', badge: 'Action Required', onClick: () => onNavigate?.('KYC') },
            { label: 'KYC Rejected', value: kpis.customers.kycRejected, color: 'text-[var(--loss)]', badge: 'Failed Verification', onClick: () => onNavigate?.('KYC') },
            { label: 'Suspended', value: kpis.customers.suspended, color: 'text-[var(--loss)]', badge: 'Restricted', onClick: () => onNavigate?.('CUSTOMERS', 'SUSPENDED') },
          ].map(k => (
            <div
              key={k.label}
              onClick={k.onClick}
              className="group bg-[var(--bg-surface)]/70 hover:bg-[var(--bg-surface)]/90 border border-[var(--border-color)]/80 hover:border-[var(--primary)]/40 rounded-xl p-3.5 transition-all duration-300 shadow-lg hover:-translate-y-0.5 cursor-pointer"
            >
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{k.label}</span>
              <span className={`text-2xl font-extrabold ${k.color} font-mono tracking-tight block mt-1`}>
                {k.value.toLocaleString()}
              </span>
              <span className="text-[9px] font-semibold text-[var(--text-tertiary)] mt-1 block truncate group-hover:text-[var(--primary)] transition-colors">{k.badge} →</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: TRADING ACTIVITY & VOLUME */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--info)]" /> Trading Activity & Volume Today
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Orders Today', value: kpis.trading.ordersToday.toLocaleString(), color: 'text-[var(--text-main)]', onClick: () => onNavigate?.('ORDERS') },
            { label: 'Executed Trades', value: kpis.trading.tradesToday.toLocaleString(), color: 'text-[var(--primary)]', onClick: () => onNavigate?.('ORDERS') },
            { label: 'Total Turnover', value: `₹${(kpis.trading.turnover / 100000).toFixed(2)}L`, color: 'text-[var(--gogrow-blue)]', onClick: () => onNavigate?.('ORDERS') },
            { label: 'Buy Turnover', value: `₹${(kpis.trading.buyValue / 100000).toFixed(2)}L`, color: 'text-[var(--primary)]', onClick: () => onNavigate?.('ORDERS') },
            { label: 'Sell Turnover', value: `₹${(kpis.trading.sellValue / 100000).toFixed(2)}L`, color: 'text-[var(--loss)]', onClick: () => onNavigate?.('ORDERS') },
            { label: 'Active Traders', value: kpis.trading.activeTraders.toLocaleString(), color: 'text-[var(--info)]', onClick: () => onNavigate?.('ORDERS') },
          ].map(k => (
            <div
              key={k.label}
              onClick={k.onClick}
              className="bg-[var(--bg-surface)]/70 hover:bg-[var(--bg-surface)]/90 border border-[var(--border-color)]/80 hover:border-[var(--info)]/40 rounded-xl p-3.5 transition-all duration-300 shadow-lg hover:-translate-y-0.5 cursor-pointer"
            >
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{k.label}</span>
              <span className={`text-2xl font-extrabold ${k.color} font-mono tracking-tight block mt-1`}>
                {k.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3 & 4: FINANCIAL & RISK GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Financial Overview */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[var(--primary)]" /> Capital & Financial Position
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Account Funds', value: `₹${kpis.financial.totalFunds.toLocaleString('en-IN')}`, color: 'text-[var(--primary)]', desc: 'Pool Capital', onClick: () => onNavigate?.('FUNDS') },
              { label: 'Margin Utilized', value: `₹${kpis.financial.marginUtilized.toLocaleString('en-IN')}`, color: 'text-[var(--warning)]', desc: 'Blocked Margin', onClick: () => onNavigate?.('RISK') },
              { label: 'Brokerage Revenue', value: `₹${kpis.financial.brokerage.toLocaleString('en-IN')}`, color: 'text-[var(--gogrow-blue)]', desc: 'Zero Fee Active', onClick: () => onNavigate?.('FUNDS') },
              { label: 'Pending Withdrawals', value: kpis.financial.pendingWithdrawals, color: 'text-[var(--loss)]', desc: 'Fund Requests', onClick: () => onNavigate?.('FUNDS') },
            ].map(k => (
              <div
                key={k.label}
                onClick={k.onClick}
                className="bg-[var(--bg-surface)]/70 border border-[var(--border-color)]/80 hover:border-[var(--primary)]/40 rounded-xl p-4 transition-all duration-300 shadow-lg cursor-pointer hover:-translate-y-0.5"
              >
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{k.label}</span>
                <span className={`text-xl font-extrabold ${k.color} font-mono tracking-tight block mt-1`}>{k.value}</span>
                <span className="text-[9px] font-medium text-[var(--text-tertiary)] block mt-1">{k.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Overview */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[var(--loss)]" /> Risk & Compliance Oversight
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'High-Risk Clients', value: kpis.risk.highRiskClients, color: 'text-[var(--loss)]', desc: 'Over-leveraged', onClick: () => onNavigate?.('RISK') },
              { label: 'Margin Call Alerts', value: kpis.risk.marginAlerts, color: 'text-[var(--warning)]', desc: 'Shortfall Warnings', onClick: () => onNavigate?.('RISK') },
              { label: 'RMS Order Blocks', value: kpis.risk.rmsBlocks, color: 'text-[var(--loss)]', desc: 'Pre-Trade Rejections', onClick: () => onNavigate?.('RISK') },
              { label: 'Frozen Accounts', value: kpis.risk.frozenAccounts, color: 'text-[var(--loss)]', desc: 'Suspended Access', onClick: () => onNavigate?.('CUSTOMERS', 'SUSPENDED') },
            ].map(k => (
              <div
                key={k.label}
                onClick={k.onClick}
                className="bg-[var(--bg-surface)]/70 border border-[var(--border-color)]/80 hover:border-[var(--loss)]/40 rounded-xl p-4 transition-all duration-300 shadow-lg cursor-pointer hover:-translate-y-0.5"
              >
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{k.label}</span>
                <span className={`text-xl font-extrabold ${k.color} font-mono tracking-tight block mt-1`}>{k.value}</span>
                <span className="text-[9px] font-medium text-[var(--text-tertiary)] block mt-1">{k.desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTION 5: INFRASTRUCTURE & BROKER HEALTH */}
      <div className="flex flex-col gap-3 pb-4">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
          <Server className="w-4 h-4 text-[var(--gogrow-blue)]" /> Infrastructure & Market Feed Health
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatusBadge label="API Core" status={kpis.technology.apiStatus} />
          <StatusBadge label="WebSocket Gateway" status={kpis.technology.wsStatus} />
          <StatusBadge label="DhanHQ Broker" status={kpis.technology.brokerStatus} />
          <StatusBadge label="Market Data" status={kpis.technology.marketDataStatus} />
          <StatusBadge label="Order Engine (OMS)" status={kpis.technology.omsStatus} />
          <StatusBadge label="Risk Engine (RMS)" status={kpis.technology.rmsStatus} />
          <StatusBadge label="PostgreSQL DB" status={kpis.technology.databaseHealth} />
        </div>
      </div>

      {/* Active Clients & Positions Drilldown Modal */}
      <ActivePositionsModal
        isOpen={showActivePositionsModal}
        onClose={() => setShowActivePositionsModal(false)}
        token={token}
      />

    </div>
  );
};

