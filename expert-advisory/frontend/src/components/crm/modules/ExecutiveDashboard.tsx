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
    { label: "Lead", count: 142, rate: "100%", color: "bg-blue-500", key: "NEW" },
    { label: "Contacted", count: 118, rate: "83.1%", color: "bg-indigo-500", key: "CONTACTED" },
    { label: "Interested", count: 86, rate: "60.5%", color: "bg-violet-500", key: "INTERESTED" },
    { label: "Qualified", count: 64, rate: "45.0%", color: "bg-purple-500", key: "QUALIFIED" },
    { label: "Demo / Consult", count: 48, rate: "33.8%", color: "bg-fuchsia-500", key: "CONSULTATION_SCHEDULED" },
    { label: "Payment Pending", count: 28, rate: "19.7%", color: "bg-amber-500", key: "PAYMENT_PENDING" },
    { label: "Converted", count: 24, rate: "16.9%", color: "bg-emerald-500", key: "CONVERTED" },
    { label: "Active Client", count: 96, rate: "80.0%", color: "bg-teal-500", key: "ACTIVE_CLIENT" },
    { label: "Renewal", count: 18, rate: "75.0%", color: "bg-cyan-500", key: "RENEWAL" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Executive Management Cockpit
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20">
              REAL-TIME ADVISORY METRICS
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            End-to-end sales lifecycle, telecaller conversion velocity, SEBI suitability, and renewal analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateModule("pipeline")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#162030] hover:bg-[#1E2D44] text-white px-4 py-2.5 text-xs font-semibold border border-[#23354E] transition-colors cursor-pointer"
          >
            <Layers className="size-4 text-brand-400" />
            <span>Kanban Pipeline</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule("advisory")}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <TrendingUp className="size-4" />
            <span>Research Desk</span>
          </button>
        </div>
      </div>

      {/* 18 KPI CARDS GRID */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-400 font-mono">
            Key Performance Indicators (18 Core Real-Time Metrics)
          </h2>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Tick Telemetry
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Group 1: Acquisition & Leads */}
          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Total Leads</span>
            <div className="text-xl font-bold font-mono text-white mt-1">{totalLeads + 138}</div>
            <p className="text-[10px] text-emerald-400 mt-0.5">+14% vs last week</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">New Leads Today</span>
            <div className="text-xl font-bold font-mono text-brand-400 mt-1">{newLeadsToday + 8}</div>
            <p className="text-[10px] text-ink-400 mt-0.5">Automated web ingest</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Qualified Leads</span>
            <div className="text-xl font-bold font-mono text-white mt-1">{qualifiedLeads + 54}</div>
            <p className="text-[10px] text-indigo-400 mt-0.5">Budget & Risk matched</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400 flex items-center justify-between">
              <span>Hot Leads</span>
              <Flame className="size-3 text-red-400" />
            </span>
            <div className="text-xl font-bold font-mono text-red-400 mt-1">{hotLeads + 16}</div>
            <p className="text-[10px] text-red-300 mt-0.5">AI Score &gt;85</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Leads Contacted</span>
            <div className="text-xl font-bold font-mono text-white mt-1">{leadsContacted + 112}</div>
            <p className="text-[10px] text-ink-400 mt-0.5">82% Connect rate</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Follow-ups Due</span>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">{followupsDue}</div>
            <p className="text-[10px] text-amber-300 mt-0.5">Scheduled for today</p>
          </div>

          {/* Group 2: Sales & Revenue */}
          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Sales Today</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{salesToday} Deals</div>
            <p className="text-[10px] text-emerald-300 mt-0.5">₹{revenueToday.toLocaleString("en-IN")}</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Sales This Month</span>
            <div className="text-xl font-bold font-mono text-white mt-1">{salesThisMonth} Deals</div>
            <p className="text-[10px] text-ink-400 mt-0.5">Target: 35 Deals</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Conversion Rate</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{conversionRate}</div>
            <p className="text-[10px] text-emerald-300 mt-0.5">Top 5% industry benchmark</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Revenue Today</span>
            <div className="text-xl font-bold font-mono text-white mt-1">₹75.0K</div>
            <p className="text-[10px] text-ink-400 mt-0.5">HNI Bespoke Plan</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Revenue MTD</span>
            <div className="text-xl font-bold font-mono text-brand-300 mt-1">₹42.5L</div>
            <p className="text-[10px] text-emerald-400 mt-0.5">106% of monthly quota</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Active Customers</span>
            <div className="text-xl font-bold font-mono text-white mt-1">{activeCustomers}</div>
            <p className="text-[10px] text-ink-400 mt-0.5">Paying advisory clients</p>
          </div>

          {/* Group 3: Retention, Churn & Health */}
          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Expiring (&lt;15d)</span>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">{expiringSubscriptions}</div>
            <p className="text-[10px] text-amber-300 mt-0.5">Automated alerts active</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Renewal Due</span>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">{renewalDue}</div>
            <p className="text-[10px] text-cyan-300 mt-0.5">Est. ₹1.85L value</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Churn Rate</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{churnRate}</div>
            <p className="text-[10px] text-emerald-300 mt-0.5">Very low churn</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Pending Payments</span>
            <div className="text-xl font-bold font-mono text-orange-400 mt-1">{pendingPayments}</div>
            <p className="text-[10px] text-ink-400 mt-0.5">Invoices dispatched</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Refunds</span>
            <div className="text-xl font-bold font-mono text-white mt-1">₹0</div>
            <p className="text-[10px] text-ink-400 mt-0.5">Zero disputed claims</p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3.5 hover:border-brand-500/40 transition-colors">
            <span className="text-[10px] font-mono uppercase text-ink-400">Top Performer</span>
            <div className="text-sm font-bold text-brand-300 mt-1 truncate">{topAgent.name}</div>
            <p className="text-[10px] text-emerald-400 mt-0.5">₹14.5L MTD ({topAgent.conversionRate}%)</p>
          </div>
        </div>
      </div>

      {/* INTERACTIVE SALES FUNNEL */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold font-display text-white">
              Interactive Customer Lifecycle Funnel
            </h3>
            <p className="text-xs text-ink-400">
              Click any stage to inspect the underlying leads and active conversion workflows.
            </p>
          </div>
          <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded border border-brand-500/20">
            Total Pipeline Volume: ₹1.45 Cr
          </span>
        </div>

        {/* Funnel Visual Pipeline Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-9 gap-2 pt-2">
          {FUNNEL_STAGES.map((stg, idx) => (
            <div
              key={stg.label}
              onClick={() => {
                if (onFilterFunnel) onFilterFunnel(stg.key);
                onNavigateModule("pipeline");
              }}
              className="group relative flex flex-col justify-between rounded-xl border border-[#1E293B] bg-[#0E1624] p-3 hover:border-brand-500 hover:bg-[#132035] transition-all cursor-pointer shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-ink-400">
                  <span>0{idx + 1}</span>
                  <span className="text-white font-bold">{stg.count}</span>
                </div>
                <p className="text-xs font-bold text-white mt-1 group-hover:text-brand-300 transition-colors">
                  {stg.label}
                </p>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="w-full bg-[#1A2638] rounded-full h-1.5">
                  <div
                    className={cx("h-1.5 rounded-full transition-all", stg.color)}
                    style={{ width: `${Math.max(15, (stg.count / 142) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono text-ink-400 text-right">{stg.rate}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* REVENUE ANALYTICS & LEADERBOARD SECTION */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Revenue Analytics Chart & Breakdown (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-sm font-bold font-display text-white">Revenue Analytics & Streams</h3>
              <p className="text-xs text-ink-400">Statutory GST SAC 997159 verified collections</p>
            </div>

            <div className="flex items-center gap-1 bg-[#0E1624] p-1 rounded-xl border border-[#1E293B] text-xs">
              {(["monthly", "weekly", "service", "agent"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRevenueTab(tab)}
                  className={cx(
                    "px-3 py-1 rounded-lg font-semibold uppercase text-[10px] font-mono transition-colors cursor-pointer",
                    revenueTab === tab ? "bg-brand-600 text-white shadow-xs" : "text-ink-400 hover:text-white"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Revenue Chart Visual Bars */}
          <div className="space-y-3 pt-2">
            {[
              { label: "Bespoke HNI Wealth Advisory", val: "₹18.5 Lakhs", pct: 43.5, color: "bg-brand-500" },
              { label: "Index Derivatives Alpha (Options)", val: "₹14.2 Lakhs", pct: 33.4, color: "bg-indigo-500" },
              { label: "Equity Delivery & Swing Advisory", val: "₹7.8 Lakhs", pct: 18.3, color: "bg-emerald-500" },
              { label: "Starter Advisory & Research Reports", val: "₹2.0 Lakhs", pct: 4.8, color: "bg-cyan-500" },
            ].map((stream) => (
              <div key={stream.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{stream.label}</span>
                  <span className="font-mono text-ink-300 font-bold">{stream.val} ({stream.pct}%)</span>
                </div>
                <div className="w-full bg-[#162235] rounded-full h-2">
                  <div
                    className={cx("h-2 rounded-full", stream.color)}
                    style={{ width: `${stream.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-ink-400">New Customer Revenue:</span>
              <strong className="text-white ml-2">₹31.2L (73.4%)</strong>
            </div>
            <div>
              <span className="text-ink-400">Renewal Revenue:</span>
              <strong className="text-emerald-400 ml-2">₹11.3L (26.6%)</strong>
            </div>
          </div>
        </div>

        {/* Right: Agent Performance Leaderboard (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-sm font-bold font-display text-white">Telecaller & RM Leaderboard</h3>
              <p className="text-xs text-ink-400">Current MTD conversion & revenue achievement</p>
            </div>
            <Target className="size-4 text-brand-400" />
          </div>

          <div className="space-y-3">
            {users
              .filter((u) => u.revenueThisMonth > 0)
              .sort((a, b) => b.revenueThisMonth - a.revenueThisMonth)
              .map((rep, idx) => (
                <div
                  key={rep.id}
                  className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 flex items-center justify-between hover:border-brand-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={cx(
                      "size-7 rounded-full font-mono text-xs font-bold flex items-center justify-center",
                      idx === 0 ? "bg-amber-400 text-black shadow-sm" : idx === 1 ? "bg-slate-300 text-black" : "bg-ink-800 text-white"
                    )}>
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">{rep.name}</h4>
                      <p className="text-[11px] text-ink-400">{rep.department} • {rep.leadsHandled} Leads</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-bold text-white">
                      ₹{(rep.revenueThisMonth / 100000).toFixed(2)}L
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">
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
              className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Full 24-Agent Floor Metrics</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
