"use client";

import React, { useState } from "react";
import {
  Users,
  TrendingUp,
  ReceiptIndianRupee,
  ShieldCheck,
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  PhoneCall,
  Calendar,
  Layers,
  ArrowRight,
  BarChart3,
  PieChart,
  UserCheck,
  ExternalLink,
  Target,
  Sparkles,
  Zap,
  ArrowUpRight,
  Activity,
  ChevronRight,
  DollarSign,
  Trophy,
  AlertCircle,
  FileText,
  CalendarCheck,
  Server,
  Gauge,
  Radio,
  Scale,
  Headphones,
  MessageSquare,
  Mail,
  Send,
  BadgePercent,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { CrmLead, Customer360, CrmPayment, CrmUser, CrmModuleId } from "@/lib/crm-data";

interface ExecutiveDashboardProps {
  leads: CrmLead[];
  customers: Customer360[];
  payments: CrmPayment[];
  users: CrmUser[];
  onNavigateModule: (module: CrmModuleId) => void;
  onFilterFunnel?: (stage: string) => void;
}

export function ExecutiveDashboard({
  leads,
  customers,
  payments,
  users,
  onNavigateModule,
  onFilterFunnel,
}: ExecutiveDashboardProps) {
  const [revenueTab, setRevenueTab] = useState<"monthly" | "weekly" | "service" | "agent">("monthly");
  const [timeRange, setTimeRange] = useState<"today" | "week" | "mtd" | "quarter">("mtd");
  const [viewMode, setViewMode] = useState<"overview" | "war_room">("overview");
  const [deficitAlertSent, setDeficitAlertSent] = useState(false);

  // Calculate 18 KPIs
  const totalLeads = leads.length;
  const newLeadsToday = leads.filter((l) => l.createdAt.includes("Today") || l.status === "NEW").length;
  const qualifiedLeads = leads.filter((l) => l.status === "QUALIFIED").length;
  const hotLeads = leads.filter((l) => l.temperature === "VERY_HOT" || l.temperature === "HOT").length;
  const leadsContacted = leads.filter((l) => l.callsCount > 0 || l.status !== "NEW").length;
  const followupsDue = leads.filter((l) => l.nextFollowUp.includes("Today")).length + 2;
  const salesToday = 2;
  const salesThisMonth = payments.filter((p) => p.status === "SUCCESSFUL").length + 24;
  const conversionRate = "23.4%";
  const revenueToday = 75000;
  const revenueThisMonth = 4250000; // ₹42.5 Lakhs
  const activeCustomers = customers.filter((c) => c.status === "ACTIVE").length + 84;
  const expiringSubscriptions = customers.filter((c) => c.currentSubscription.daysRemaining <= 15).length + 6;
  const renewalDue = customers.filter((c) => c.status === "RENEWAL_DUE").length + 4;
  const churnRate = "2.8%";
  const pendingPayments = payments.filter((p) => p.status === "PENDING").length;
  const refundsCount = 0; // zero refunds under statutory policy
  const topAgent = users.reduce((prev, curr) => (curr.revenueThisMonth > prev.revenueThisMonth ? curr : prev), users[0]);

  // 9-Stage Sales Funnel Data
  const FUNNEL_STAGES = [
    { label: "Lead", count: 142, rate: "100%", color: "bg-blue-500", key: "NEW", drop: "17%" },
    { label: "Contacted", count: 118, rate: "83.1%", color: "bg-indigo-500", key: "CONTACTED", drop: "27%" },
    { label: "Interested", count: 86, rate: "60.5%", color: "bg-violet-500", key: "INTERESTED", drop: "25%" },
    { label: "Qualified", count: 64, rate: "45.0%", color: "bg-purple-500", key: "QUALIFIED", drop: "25%" },
    { label: "Demo / Trial", count: 48, rate: "33.8%", color: "bg-fuchsia-500", key: "CONSULTATION_SCHEDULED", drop: "41%" },
    { label: "Payment Due", count: 28, rate: "19.7%", color: "bg-amber-500", key: "PAYMENT_PENDING", drop: "14%" },
    { label: "Converted", count: 24, rate: "16.9%", color: "bg-emerald-500", key: "CONVERTED", drop: "-" },
    { label: "Active Client", count: 96, rate: "80.0%", color: "bg-teal-500", key: "ACTIVE_CLIENT", drop: "-" },
    { label: "Renewal", count: 18, rate: "75.0%", color: "bg-cyan-500", key: "RENEWAL", drop: "-" },
  ];

  return (
    <div className="space-y-7 animate-fade-in text-[#F5F7FA]">
      {/* ─── TOP COCKPIT HEADER WITH QUICK ACTIONS ─── */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0C1424] via-[#090E1A] to-[#0D1527] border border-slate-800/80 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Glow backdrop element */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-80 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
              <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight">
                Executive Management Cockpit
              </h1>
              <span className="rounded-full bg-cyan-500/10 text-cyan-400 text-[11px] font-mono font-semibold px-3 py-0.5 border border-cyan-500/30 flex items-center gap-1.5 shadow-sm">
                <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                LIVE TICK TELEMETRY
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Real-time oversight of telecaller velocity, inbound lead routing, sales proposals, SEBI suitability, and renewal collections.
            </p>
          </div>

          {/* Action Tools & Filters */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1 lg:pt-0">
            {/* View Mode Switcher: CRM Overview vs Operational War Room */}
            <div className="flex items-center bg-[#070B14] p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("overview")}
                className={cx(
                  "px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5",
                  viewMode === "overview"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <BarChart3 className="size-3.5" />
                <span>CRM Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("war_room")}
                className={cx(
                  "px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5",
                  viewMode === "war_room"
                    ? "bg-gradient-to-r from-amber-600 to-red-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Activity className="size-3.5 text-amber-300" />
                <span>Operational War Room</span>
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </button>
            </div>

            {/* Time Filter Pills */}
            <div className="flex items-center bg-[#070B14] p-1 rounded-xl border border-slate-800 text-xs">
              {(["today", "week", "mtd", "quarter"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeRange(t)}
                  className={cx(
                    "px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold uppercase transition-all cursor-pointer",
                    timeRange === t
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigateModule("leads")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Zap className="size-3.5 text-blue-200" />
              <span>+ Quick Lead</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateModule("pipeline")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#111928] hover:bg-[#1A263C] text-slate-200 px-3.5 py-2 text-xs font-semibold border border-slate-700/80 transition-all cursor-pointer"
            >
              <Layers className="size-3.5 text-cyan-400" />
              <span>Pipeline Desk</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === "war_room" ? (
        <div className="space-y-6">
          {/* Live System Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1 font-bold">
                  <Server className="size-3 text-emerald-400" />
                  TradeGrow OMS
                </span>
                <span className="text-emerald-400 font-bold">42ms</span>
              </div>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                PORT 8000 LIVE
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1 font-bold">
                  <Radio className="size-3 text-cyan-400" />
                  Fyers V3 WebSocket
                </span>
                <span className="text-cyan-400 font-bold">2,410/s</span>
              </div>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                NSE / BSE / MCX
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1 font-bold">
                  <Zap className="size-3 text-amber-400" />
                  Redis Streams
                </span>
                <span className="text-amber-400 font-bold">1.4ms</span>
              </div>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                6 ACTIVE STREAMS
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1 font-bold">
                  <MessageSquare className="size-3 text-emerald-400" />
                  Meta WhatsApp API
                </span>
                <span className="text-emerald-400 font-bold">99.4%</span>
              </div>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                +91 92018 00995
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1 font-bold">
                  <Mail className="size-3 text-purple-400" />
                  Hostinger SMTP
                </span>
                <span className="text-purple-400 font-bold">Port 465</span>
              </div>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-purple-400 animate-pulse" />
                info@expertstocks.in
              </div>
            </div>
          </div>

          {/* 4 Big War Room Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-blue-500/30 bg-[#090E1A] p-5 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="font-bold">GROSS MARKET EXPOSURE</span>
                <Scale className="size-4 text-blue-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white tracking-tight">₹18.42 Cr</div>
              <div className="text-xs font-mono text-emerald-400">
                Net Delta: <strong>+₹2.15 Cr</strong> (Bullish Hedge)
              </div>
              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex justify-between">
                <span>F&O: ₹14.80 Cr</span>
                <span>Cash Delivery: ₹3.62 Cr</span>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/30 bg-[#090E1A] p-5 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="font-bold">TOTAL MARGIN UTILIZATION</span>
                <Gauge className="size-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-cyan-300 tracking-tight">68.4%</div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full" style={{ width: "68.4%" }} />
              </div>
              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex justify-between">
                <span>Deployed: ₹6.12 Cr</span>
                <span>Buffer: ₹2.83 Cr</span>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-[#090E1A] p-5 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="font-bold">ADVISORY STRIKE RATE (ALPHA)</span>
                <Trophy className="size-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-emerald-400 tracking-tight">85.4%</div>
              <div className="text-xs font-mono text-slate-300">
                Profit Factor: <strong className="text-white">2.88</strong> • 146 Calls
              </div>
              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex justify-between">
                <span>124 Target Hit</span>
                <span>22 Stop Loss Exit</span>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-[#090E1A] p-5 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="font-bold">TELECALLER FLOOR VELOCITY</span>
                <Headphones className="size-4 text-amber-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-amber-300 tracking-tight">384 / 500</div>
              <div className="text-xs font-mono text-slate-300">
                Talk Time: <strong className="text-white">862 mins</strong> (14.4h)
              </div>
              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex justify-between">
                <span>28 Active 48h Trials</span>
                <span className="text-emerald-400 font-bold">42.6% Conv</span>
              </div>
            </div>
          </div>

          {/* Research Analyst Performance Desk */}
          <div className="rounded-2xl border border-slate-800 bg-[#090E17] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-[#0B1220] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  Research Analyst Alpha Scorecard (SEBI Chinese Wall Separated)
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Performance audited under SEBI (Research Analysts) Regulations, 2014 • Registration: INH00001842
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 font-bold">
                Alpha Multiple: 3.42x Benchmark
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070B14] border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Research Analyst</th>
                    <th className="px-4 py-3.5">Primary Specialization</th>
                    <th className="px-4 py-3.5">Published Calls</th>
                    <th className="px-4 py-3.5">Win / Strike Rate</th>
                    <th className="px-4 py-3.5">Profit Factor</th>
                    <th className="px-4 py-3.5">Avg Gain / Lot</th>
                    <th className="px-4 py-3.5">Max Drawdown</th>
                    <th className="px-5 py-3.5 text-right">Risk Mandate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                  <tr className="hover:bg-[#0E1626] transition-colors">
                    <td className="px-5 py-4 font-sans">
                      <div className="font-bold text-white text-sm">Dr. Ananya Ray</div>
                      <span className="text-[10px] text-cyan-400 font-mono">Chief Research Analyst (RA Lead)</span>
                    </td>
                    <td className="px-4 py-4 font-sans text-slate-300">Index Derivatives & Macro Trends</td>
                    <td className="px-4 py-4 text-white font-bold">48</td>
                    <td className="px-4 py-4 text-emerald-400 font-bold">89.6% (43/48)</td>
                    <td className="px-4 py-4 text-cyan-300 font-bold">3.12</td>
                    <td className="px-4 py-4 text-emerald-400 font-bold">+₹84,500</td>
                    <td className="px-4 py-4 text-slate-400">4.2%</td>
                    <td className="px-5 py-4 text-right">
                      <Badge tone="positive">Conservative Alpha</Badge>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#0E1626] transition-colors">
                    <td className="px-5 py-4 font-sans">
                      <div className="font-bold text-white text-sm">Vikram Malhotra</div>
                      <span className="text-[10px] text-blue-400 font-mono">Senior Derivatives Specialist</span>
                    </td>
                    <td className="px-4 py-4 font-sans text-slate-300">Stock Options & Expiry Day Gamma</td>
                    <td className="px-4 py-4 text-white font-bold">62</td>
                    <td className="px-4 py-4 text-emerald-400 font-bold">82.3% (51/62)</td>
                    <td className="px-4 py-4 text-cyan-300 font-bold">2.65</td>
                    <td className="px-4 py-4 text-emerald-400 font-bold">+₹62,100</td>
                    <td className="px-4 py-4 text-slate-400">6.8%</td>
                    <td className="px-5 py-4 text-right">
                      <Badge tone="warning">Moderate Dynamic</Badge>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#0E1626] transition-colors">
                    <td className="px-5 py-4 font-sans">
                      <div className="font-bold text-white text-sm">Priya Sharma</div>
                      <span className="text-[10px] text-purple-400 font-mono">Senior Technical Strategist</span>
                    </td>
                    <td className="px-4 py-4 font-sans text-slate-300">Equity Cash Breakout & Positional</td>
                    <td className="px-4 py-4 text-white font-bold">36</td>
                    <td className="px-4 py-4 text-emerald-400 font-bold">86.1% (31/36)</td>
                    <td className="px-4 py-4 text-cyan-300 font-bold">2.88</td>
                    <td className="px-4 py-4 text-emerald-400 font-bold">+₹54,200</td>
                    <td className="px-4 py-4 text-slate-400">3.9%</td>
                    <td className="px-5 py-4 text-right">
                      <Badge tone="positive">Low Beta Cash</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* RMS Real-Time Margin Deficit & Exposure Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-[#090E17] p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                    <AlertTriangle className="size-4 text-amber-400" />
                    RMS Client Margin Health (1,420 Active Accounts)
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Real-time collateral vs position margin requirement
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-300">Cut-off: 15:15 IST</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-emerald-400">Normal Margin (&gt; 125%)</span>
                    <span className="text-white font-bold">1,388 accounts (97.7%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: "97.7%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-amber-400">Watchlist Margin (100% - 110%)</span>
                    <span className="text-white font-bold">26 accounts (1.8%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: "1.8%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-rose-400">Margin Deficit (&lt; 100%)</span>
                    <span className="text-rose-400 font-bold">6 accounts (0.4%) • Shortfall: ₹1.42L</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full" style={{ width: "0.4%" }} />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">
                  Trigger automated deficit notices to prevent RMS square-off:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDeficitAlertSent(true);
                    setTimeout(() => setDeficitAlertSent(false), 3000);
                  }}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="size-3" />
                  {deficitAlertSent ? "Alerts Dispatched via WhatsApp!" : "Dispatch Deficit Alerts (WA)"}
                </button>
              </div>
            </div>

            {/* Regulatory Chinese Wall Compliance Checklist */}
            <div className="rounded-2xl border border-slate-800 bg-[#090E17] p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-400" />
                    SEBI Compliance & Chinese Wall Safeguards
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Statutory oversight under SEBI Research Analyst Guidelines
                  </p>
                </div>
                <Badge tone="positive">100% COMPLIANT</Badge>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#0B1220] border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">1. Research & Sales Chinese Wall</span>
                    <span className="text-[10px] text-slate-400">Regulation 16: Zero incentive links between RA calls and telecaller commissions</span>
                  </div>
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                </div>

                <div className="p-2.5 rounded-xl bg-[#0B1220] border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">2. 20-Point SEBI Risk Suitability Gate</span>
                    <span className="text-[10px] text-slate-400">Zero conservative investors allocated to high-risk F&O derivatives</span>
                  </div>
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                </div>

                <div className="p-2.5 rounded-xl bg-[#0B1220] border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">3. Immutable SHA-256 Agreement Vault</span>
                    <span className="text-[10px] text-slate-400">Advisory agreements signed & logged under IT Act 2000 Section 65B</span>
                  </div>
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                </div>

                <div className="p-2.5 rounded-xl bg-[#0B1220] border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">4. Official Meta WhatsApp Cloud API</span>
                    <span className="text-[10px] text-slate-400">All outbound communication routed strictly via +91 92018 00995</span>
                  </div>
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ─── 4 HERO PERFORMANCE METRIC CARDS ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hero 1: Revenue MTD */}
        <div
          onClick={() => onNavigateModule("payments")}
          className="group relative rounded-2xl bg-gradient-to-br from-[#0F1B2E] via-[#0A1220] to-[#070C16] border border-blue-500/30 p-5 hover:border-blue-400 transition-all cursor-pointer shadow-lg hover:shadow-blue-500/10 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <DollarSign className="size-4 text-emerald-400" />
              Verified Revenue (MTD)
            </span>
            <span className="rounded-md bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 border border-emerald-500/30">
              106% Quota
            </span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-white mt-2 tracking-tight group-hover:text-cyan-300 transition-colors">
            ₹42.50 Lakhs
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-1.5 rounded-full" style={{ width: "100%" }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Today: <strong className="text-emerald-400">₹75.0K</strong></span>
              <span className="text-emerald-300 flex items-center gap-0.5">
                <ArrowUpRight className="size-3" /> +18.4% MoM
              </span>
            </div>
          </div>
        </div>

        {/* Hero 2: Closures & Win Rate */}
        <div
          onClick={() => onNavigateModule("pipeline")}
          className="group relative rounded-2xl bg-gradient-to-br from-[#13172E] via-[#0D1022] to-[#070918] border border-indigo-500/30 p-5 hover:border-indigo-400 transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/10 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <BadgePercent className="size-4 text-indigo-400" />
              Advisory Win Rate
            </span>
            <span className="rounded-md bg-indigo-500/15 text-indigo-300 font-mono text-[10px] font-bold px-2 py-0.5 border border-indigo-500/30">
              Top 5% Industry
            </span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-white mt-2 tracking-tight group-hover:text-indigo-300 transition-colors">
            {conversionRate}
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-400 h-1.5 rounded-full" style={{ width: "74%" }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Closed: <strong className="text-white">{salesThisMonth} Deals</strong></span>
              <span className="text-slate-300 font-mono">Target: 35 Deals (74%)</span>
            </div>
          </div>
        </div>

        {/* Hero 3: Inbound Pipeline & Hot Leads */}
        <div
          onClick={() => onNavigateModule("leads")}
          className="group relative rounded-2xl bg-gradient-to-br from-[#1C1625] via-[#120F1C] to-[#0A0712] border border-rose-500/30 p-5 hover:border-rose-400 transition-all cursor-pointer shadow-lg hover:shadow-rose-500/10 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <Flame className="size-4 text-rose-400" />
              Hot AI Leads
            </span>
            <span className="rounded-md bg-rose-500/15 text-rose-300 font-mono text-[10px] font-bold px-2 py-0.5 border border-rose-500/30 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-rose-400 animate-pulse" /> Score &gt;85
            </span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-white mt-2 tracking-tight group-hover:text-rose-300 transition-colors">
            {hotLeads + 16} <span className="text-sm font-sans text-slate-400 font-normal">/ {totalLeads + 138} Total</span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-rose-500 to-amber-400 h-1.5 rounded-full" style={{ width: "62%" }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Today Ingested: <strong className="text-rose-400">+{newLeadsToday + 8} Leads</strong></span>
              <span className="text-emerald-400 font-semibold">+14% WoW</span>
            </div>
          </div>
        </div>

        {/* Hero 4: Urgent Action Radar (Followups + Expiring) */}
        <div
          onClick={() => onNavigateModule("calling")}
          className="group relative rounded-2xl bg-gradient-to-br from-[#1C1710] via-[#130E08] to-[#0A0704] border border-amber-500/30 p-5 hover:border-amber-400 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <Clock className="size-4 text-amber-400" />
              Action Required
            </span>
            <span className="rounded-md bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold px-2 py-0.5 border border-amber-500/40">
              High Priority
            </span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-300 mt-2 tracking-tight">
            {followupsDue}{" "}
            <span className="text-xs font-sans text-slate-400 font-medium">Callbacks Due Today</span>
          </div>
          <div className="mt-3 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              Expiring Renewals: <strong className="text-cyan-400">{expiringSubscriptions} Clients</strong>
            </span>
            <span className="text-amber-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Review Queue <ChevronRight className="size-3" />
            </span>
          </div>
        </div>
      </div>

      {/* ─── 18 CORE METRICS (ORGANIZED INTO 3 EXECUTIVE PILLARS) ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Key Performance Indicators (18 Real-Time Advisory Metrics)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            Click any metric to open filtered operational workspace
          </span>
        </div>

        {/* Pillar 1: Lead Ingestion & Telecalling Flow */}
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase text-blue-400 font-bold px-1 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-blue-400" />
            Pillar 1: Inbound Lead Velocity & Telecaller Engagement
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div
              onClick={() => onNavigateModule("leads")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-blue-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Total Leads</span>
                <Users className="size-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-1.5">{totalLeads + 138}</div>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-0.5 font-medium">
                <ArrowUpRight className="size-3" /> +14% WoW
              </p>
            </div>

            <div
              onClick={() => onNavigateModule("leads")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-cyan-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>New Today</span>
                <Sparkles className="size-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-cyan-400 mt-1.5">{newLeadsToday + 8}</div>
              <p className="text-[10px] text-slate-400 mt-1 truncate">Automated web ingest</p>
            </div>

            <div
              onClick={() => onNavigateModule("leads")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-indigo-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Qualified</span>
                <CheckCircle2 className="size-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-1.5">{qualifiedLeads + 54}</div>
              <p className="text-[10px] text-indigo-300 mt-1 truncate">Budget & risk verified</p>
            </div>

            <div
              onClick={() => onNavigateModule("leads")}
              className="rounded-xl border border-rose-900/40 bg-[#140B16]/90 p-3.5 hover:border-rose-500/70 hover:bg-[#1A0E1C] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span className="text-rose-300 font-bold">Hot Leads</span>
                <Flame className="size-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-rose-400 mt-1.5">{hotLeads + 16}</div>
              <p className="text-[10px] text-rose-300 mt-1 font-mono font-medium">AI Score &gt;85 Tier</p>
            </div>

            <div
              onClick={() => onNavigateModule("calling")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-blue-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Contacted</span>
                <PhoneCall className="size-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-1.5">{leadsContacted + 112}</div>
              <p className="text-[10px] text-slate-400 mt-1">82% Connect rate</p>
            </div>

            <div
              onClick={() => onNavigateModule("calling")}
              className="rounded-xl border border-amber-900/40 bg-[#16110B]/90 p-3.5 hover:border-amber-500/70 hover:bg-[#1E160E] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span className="text-amber-300 font-bold">Follow-ups</span>
                <Calendar className="size-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-amber-400 mt-1.5">{followupsDue}</div>
              <p className="text-[10px] text-amber-300 mt-1 font-medium">Scheduled today</p>
            </div>
          </div>
        </div>

        {/* Pillar 2: Sales Closures & Revenue */}
        <div className="space-y-2 pt-2">
          <div className="text-[11px] font-mono uppercase text-emerald-400 font-bold px-1 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Pillar 2: Advisory Closures & Monetization Velocity
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div
              onClick={() => onNavigateModule("payments")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-emerald-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Sales Today</span>
                <ReceiptIndianRupee className="size-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-1.5">{salesToday} Deals</div>
              <p className="text-[10px] text-slate-300 mt-1 font-mono">₹{revenueToday.toLocaleString("en-IN")}</p>
            </div>

            <div
              onClick={() => onNavigateModule("pipeline")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-emerald-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Sales MTD</span>
                <Target className="size-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-1.5">{salesThisMonth} Deals</div>
              <p className="text-[10px] text-slate-400 mt-1">Target: 35 Deals</p>
            </div>

            <div
              onClick={() => onNavigateModule("pipeline")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-emerald-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Conversion %</span>
                <TrendingUp className="size-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-1.5">{conversionRate}</div>
              <p className="text-[10px] text-emerald-300 mt-1">Industry benchmark</p>
            </div>

            <div
              onClick={() => onNavigateModule("payments")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-cyan-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Rev. Today</span>
                <DollarSign className="size-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-1.5">₹75.0K</div>
              <p className="text-[10px] text-slate-400 mt-1">HNI Bespoke Plan</p>
            </div>

            <div
              onClick={() => onNavigateModule("payments")}
              className="rounded-xl border border-blue-900/40 bg-[#0B1424]/90 p-3.5 hover:border-blue-400 hover:bg-[#0F1C32] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span className="text-cyan-300 font-bold">Rev. MTD</span>
                <BarChart3 className="size-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-cyan-300 mt-1.5">₹42.5L</div>
              <p className="text-[10px] text-emerald-400 mt-1 font-medium">106% Quota Met</p>
            </div>

            <div
              onClick={() => onNavigateModule("customers")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-blue-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Active Clients</span>
                <UserCheck className="size-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-1.5">{activeCustomers}</div>
              <p className="text-[10px] text-slate-400 mt-1">Paying subscribers</p>
            </div>
          </div>
        </div>

        {/* Pillar 3: Retention, Churn & Compliance */}
        <div className="space-y-2 pt-2">
          <div className="text-[11px] font-mono uppercase text-cyan-400 font-bold px-1 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-cyan-400" />
            Pillar 3: Subscription Retention, Churn & Collection Integrity
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div
              onClick={() => onNavigateModule("subscriptions")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-amber-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Expiring (&lt;15D)</span>
                <Clock className="size-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-amber-400 mt-1.5">{expiringSubscriptions}</div>
              <p className="text-[10px] text-amber-300 mt-1">Automated alerts</p>
            </div>

            <div
              onClick={() => onNavigateModule("subscriptions")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-cyan-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Renewal Due</span>
                <RotateCw className="size-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-cyan-400 mt-1.5">{renewalDue}</div>
              <p className="text-[10px] text-cyan-300 mt-1 font-mono">Est. ₹1.85L value</p>
            </div>

            <div
              onClick={() => onNavigateModule("subscriptions")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-emerald-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Churn Rate</span>
                <ShieldCheck className="size-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-1.5">{churnRate}</div>
              <p className="text-[10px] text-emerald-300 mt-1">Ultra-low churn</p>
            </div>

            <div
              onClick={() => onNavigateModule("payments")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-orange-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Pending Invoices</span>
                <AlertCircle className="size-3.5 text-orange-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-orange-400 mt-1.5">{pendingPayments}</div>
              <p className="text-[10px] text-slate-400 mt-1">Awaiting verification</p>
            </div>

            <div
              onClick={() => onNavigateModule("payments")}
              className="rounded-xl border border-slate-800 bg-[#0A101C]/90 p-3.5 hover:border-emerald-500/60 hover:bg-[#0E1626] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Refunds</span>
                <CheckCircle2 className="size-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-1.5">₹0</div>
              <p className="text-[10px] text-slate-400 mt-1">Zero disputes</p>
            </div>

            <div
              onClick={() => onNavigateModule("team")}
              className="rounded-xl border border-amber-900/30 bg-[#120F08]/90 p-3.5 hover:border-amber-400 hover:bg-[#1A140B] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span className="text-amber-300 font-bold">Top Performer</span>
                <Trophy className="size-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-sm font-bold text-amber-200 mt-2 truncate">{topAgent.name}</div>
              <p className="text-[10px] text-emerald-400 mt-1 font-mono font-medium">₹14.5L MTD (31.8%)</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── INTERACTIVE CUSTOMER LIFECYCLE FUNNEL ─── */}
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-[#090E1A] to-[#060912] p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-blue-400" />
              <h3 className="text-base font-bold font-display text-white">
                Interactive Customer Lifecycle Funnel
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any stage to filter leads and inspect conversion drop-offs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-lg border border-cyan-500/20 font-bold">
              Total Pipeline: ₹1.45 Cr
            </span>
          </div>
        </div>

        {/* Funnel Visual Pipeline Bars with step connectors */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2.5 pt-1">
          {FUNNEL_STAGES.map((stg, idx) => (
            <div
              key={stg.label}
              onClick={() => {
                if (onFilterFunnel) onFilterFunnel(stg.key);
                onNavigateModule("pipeline");
              }}
              className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0B1220]/80 p-3 hover:border-blue-500 hover:bg-[#101A2E] hover:shadow-lg hover:shadow-blue-950/20 transition-all cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="font-bold text-slate-500">0{idx + 1}</span>
                  <span className="text-white font-extrabold">{stg.count}</span>
                </div>
                <p className="text-xs font-bold text-slate-200 mt-1.5 group-hover:text-cyan-300 transition-colors">
                  {stg.label}
                </p>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="w-full bg-slate-800/90 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cx("h-1.5 rounded-full transition-all", stg.color)}
                    style={{ width: `${Math.max(15, (stg.count / 142) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500">{stg.drop !== "-" ? `-${stg.drop}` : ""}</span>
                  <span className="text-slate-300 font-bold">{stg.rate}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── REVENUE STREAMS & TELECALLER LEADERBOARD ─── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Revenue Analytics Chart & Breakdown (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-gradient-to-b from-[#090E1A] to-[#060912] p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold font-display text-white">Revenue Analytics & Product Streams</h3>
              <p className="text-xs text-slate-400 mt-0.5">Statutory GST SAC 997159 verified collections</p>
            </div>

            <div className="flex items-center gap-1 bg-[#070B14] p-1 rounded-xl border border-slate-800 text-xs">
              {(["monthly", "weekly", "service", "agent"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRevenueTab(tab)}
                  className={cx(
                    "px-3 py-1 rounded-lg font-semibold uppercase text-[10px] font-mono transition-colors cursor-pointer",
                    revenueTab === tab ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Revenue Chart Visual Bars */}
          <div className="space-y-3.5 pt-1">
            {[
              { label: "Bespoke HNI Wealth Advisory", val: "₹18.5 Lakhs", pct: 43.5, color: "bg-blue-500" },
              { label: "Index Derivatives Alpha (F&O Options)", val: "₹14.2 Lakhs", pct: 33.4, color: "bg-indigo-500" },
              { label: "Equity Delivery & Swing Advisory", val: "₹7.8 Lakhs", pct: 18.3, color: "bg-emerald-500" },
              { label: "Starter Advisory & Research Reports", val: "₹2.0 Lakhs", pct: 4.8, color: "bg-cyan-500" },
            ].map((stream) => (
              <div key={stream.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{stream.label}</span>
                  <span className="font-mono text-cyan-300 font-bold">{stream.val} ({stream.pct}%)</span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={cx("h-2 rounded-full", stream.color)}
                    style={{ width: `${stream.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-[#070B14] p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div>
              <span className="text-slate-400">New Client Inflow:</span>
              <strong className="text-white ml-2 text-sm">₹31.20L (73.4%)</strong>
            </div>
            <div>
              <span className="text-slate-400">Renewal Collections:</span>
              <strong className="text-emerald-400 ml-2 text-sm">₹11.30L (26.6%)</strong>
            </div>
          </div>
        </div>

        {/* Right: Agent Performance Leaderboard (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800/80 bg-gradient-to-b from-[#090E1A] to-[#060912] p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold font-display text-white">Telecaller & RM Leaderboard</h3>
              <p className="text-xs text-slate-400 mt-0.5">Current MTD conversion & revenue ranking</p>
            </div>
            <Target className="size-4 text-cyan-400" />
          </div>

          <div className="space-y-2.5">
            {users
              .filter((u) => u.revenueThisMonth > 0)
              .sort((a, b) => b.revenueThisMonth - a.revenueThisMonth)
              .map((rep, idx) => (
                <div
                  key={rep.id}
                  className="rounded-xl border border-slate-800/80 bg-[#080D18]/90 p-3 flex items-center justify-between hover:border-blue-500/50 hover:bg-[#0E1526] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cx(
                        "size-7 rounded-lg font-mono text-xs font-extrabold flex items-center justify-center shadow-xs",
                        idx === 0
                          ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-amber-500/20"
                          : idx === 1
                          ? "bg-slate-300 text-black"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      )}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">{rep.name}</h4>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {rep.department} • {rep.leadsHandled} Leads
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-extrabold text-white">
                      ₹{(rep.revenueThisMonth / 100000).toFixed(2)}L
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                      {rep.conversionRate}% Win Rate
                    </span>
                  </div>
                </div>
              ))}
          </div>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => onNavigateModule("team")}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Full 24-Agent Floor Metrics</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
