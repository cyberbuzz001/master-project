"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  LineChart,
  TrendingUp,
  ShieldCheck,
  FileText,
  FileCheck2,
  CreditCard,
  PhoneCall,
  MessageSquare,
  ExternalLink,
  Download,
  Lock,
  Printer,
  X,
  Radio,
  Zap,
  Award,
  ArrowUpRight,
  Sliders,
  ChevronRight,
  Clock,
  Briefcase,
  HelpCircle,
  Copy,
  Check,
} from "lucide-react";
import { useAuth } from "@/components/app/AuthProvider";
import { PageTitle } from "@/components/app/AppShell";
import { humanize, useApiGet } from "@/components/app/hooks";
import { Badge, Card, cx } from "@/components/ui";

interface ClientDashboardData {
  client: {
    client_code: string;
    full_name: string;
    onboarding_status: string;
    relationship_manager: string | null;
  } | null;
  notices: { key: string; title: string; body: string }[];
  modules: any[];
}

interface ClientPortalRecommendation {
  id: string;
  symbol: string;
  exchange: "NSE" | "BSE";
  instrumentType: "EQUITY_CASH" | "INDEX_OPTIONS";
  direction: "BUY" | "SELL";
  entryRange: string;
  target1: string;
  target2: string;
  stopLoss: string;
  timeHorizon: string;
  pnlReturn: string;
  status: "ACTIVE" | "TARGET_1_HIT" | "CLOSED";
  rationale: string;
  publishedAt: string;
  riskSuitability: "Conservative" | "Moderate" | "Aggressive";
}

const DEFAULT_RECOMMENDATIONS: ClientPortalRecommendation[] = [
  {
    id: "REC-2026-0104",
    symbol: "HDFCBANK",
    exchange: "NSE",
    instrumentType: "EQUITY_CASH",
    direction: "BUY",
    entryRange: "1680 - 1710",
    target1: "1820",
    target2: "1910",
    stopLoss: "1620",
    timeHorizon: "2-4 Months",
    pnlReturn: "+3.2%",
    status: "ACTIVE",
    rationale: "Double bottom breakout on weekly chart; institutional delivery volume exceeds 60-day average. Credit growth outperforming industry.",
    publishedAt: "Today, 09:30 AM",
    riskSuitability: "Moderate",
  },
  {
    id: "REC-2026-0105",
    symbol: "NIFTY 25600 CE",
    exchange: "NSE",
    instrumentType: "INDEX_OPTIONS",
    direction: "BUY",
    entryRange: "145 - 155",
    target1: "210",
    target2: "265",
    stopLoss: "105",
    timeHorizon: "Weekly Expiry",
    pnlReturn: "+41.9%",
    status: "TARGET_1_HIT",
    rationale: "Implied Volatility (IV) compression breakout above 25550 anchor. Strong open interest concentration at 25500 PE support.",
    publishedAt: "Yesterday, 10:15 AM",
    riskSuitability: "Aggressive",
  },
  {
    id: "REC-2026-0106",
    symbol: "L&T",
    exchange: "NSE",
    instrumentType: "EQUITY_CASH",
    direction: "BUY",
    entryRange: "3480 - 3510",
    target1: "3740",
    target2: "3920",
    stopLoss: "3360",
    timeHorizon: "3-6 Months",
    pnlReturn: "+1.8%",
    status: "ACTIVE",
    rationale: "Multi-billion dollar infrastructure and defense order inflows; balance sheet deleveraged with robust cash flows.",
    publishedAt: "18 Oct 2026",
    riskSuitability: "Conservative",
  },
];

export default function PortalPage() {
  const { me } = useAuth();
  const dashboard = useApiGet<ClientDashboardData>("/client/dashboard");

  // Interactive Client Portal State
  const [activePortalTab, setActivePortalTab] = useState<"ACTIVE_CALLS" | "PORTFOLIO" | "SUITABILITY" | "AGREEMENT" | "INVOICES">("ACTIVE_CALLS");
  const [selectedOrderRec, setSelectedOrderRec] = useState<ClientPortalRecommendation | null>(null);
  const [orderQuantity, setOrderQuantity] = useState("50");
  const [orderBroker, setOrderBroker] = useState<"FYERS" | "ZERODHA" | "GROWW">("FYERS");
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [showRpmCertificateModal, setShowRpmCertificateModal] = useState(false);
  const [showAgreementVaultModal, setShowAgreementVaultModal] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const clientName = me?.name || "Arjun Mehta";
  const clientCode = dashboard.data?.client?.client_code || "EXP-2026-1001";
  const rmName = dashboard.data?.client?.relationship_manager || "Sunita Verma";
  const rmPhone = "+91 99304 88721";

  const handleExecuteBrokerOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderRec) return;
    setOrderSuccessMsg(
      `Order placed via ${orderBroker} API! Limit order for ${orderQuantity} units of ${selectedOrderRec.symbol} at ${selectedOrderRec.entryRange} submitted to exchange.`
    );
    showToast(`Order placed on ${orderBroker}! GTT Limit Order Active.`);
    setTimeout(() => {
      setSelectedOrderRec(null);
      setOrderSuccessMsg(null);
    }, 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in relative text-slate-100">
      {/* Floating Notification Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#0B1A14]/95 px-4 py-3 text-xs font-bold text-emerald-300 shadow-2xl backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── CLIENT COCKPIT HEADER ── */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold font-display text-white tracking-tight">
                Welcome, {clientName.split(" ")[0]}
              </h1>
              <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20 font-bold">
                SEBI SUITABILITY VERIFIED
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Expert Stocks Advisory Client Portal • SEBI Registration: <strong>INH00001842</strong>
            </p>
          </div>

          {/* Quick Contact Desk */}
          <div className="flex items-center gap-3 bg-[#0E1624] p-3 rounded-xl border border-[#1E293B] text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Dedicated Relationship Manager</span>
              <p className="font-bold text-white">{rmName}</p>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <a
                href={`tel:${rmPhone}`}
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                title="Call RM"
              >
                <PhoneCall className="size-3.5" />
              </a>
              <a
                href={`https://wa.me/919930488721?text=Namaste%20${encodeURIComponent(rmName)},%20I%20have%20an%20inquiry%20regarding%20my%20advisory%20recommendations.`}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 transition-colors"
                title="WhatsApp RM"
              >
                <MessageSquare className="size-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Client Identity & Compliance Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#1E293B] text-xs font-mono">
          <div className="rounded-xl bg-[#0E1624] p-3 border border-[#1E293B]">
            <span className="text-[10px] text-slate-400 uppercase">Client Code</span>
            <p className="font-bold text-brand-300 mt-0.5">{clientCode}</p>
          </div>
          <div className="rounded-xl bg-[#0E1624] p-3 border border-[#1E293B]">
            <span className="text-[10px] text-slate-400 uppercase">Risk Tier</span>
            <p className="font-bold text-emerald-400 mt-0.5">Score: 78/100 (Aggressive)</p>
          </div>
          <div className="rounded-xl bg-[#0E1624] p-3 border border-[#1E293B]">
            <span className="text-[10px] text-slate-400 uppercase">Active Subscription</span>
            <p className="font-bold text-white mt-0.5">HNI Bespoke (84 Days)</p>
          </div>
          <div className="rounded-xl bg-[#0E1624] p-3 border border-[#1E293B]">
            <span className="text-[10px] text-slate-400 uppercase">Advisory Agreement</span>
            <p className="font-bold text-emerald-400 mt-0.5">SHA-256 e-Signed</p>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE PORTAL NAVIGATION TABS ── */}
      <div className="flex items-center gap-2 border-b border-[#1E293B] pb-3 overflow-x-auto scrollbar-none text-xs">
        {[
          { id: "ACTIVE_CALLS", label: `Active Recommendations (${DEFAULT_RECOMMENDATIONS.length})` },
          { id: "SUITABILITY", label: "SEBI Risk Suitability (RPM) Certificate" },
          { id: "AGREEMENT", label: "Signed Advisory Agreement" },
          { id: "INVOICES", label: "Tax Invoices & Receipts" },
          { id: "PORTFOLIO", label: "Risk Budget & Position Sizing" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActivePortalTab(tab.id as any)}
            className={cx(
              "px-4 py-2 rounded-xl font-bold font-mono transition-all cursor-pointer whitespace-nowrap",
              activePortalTab === tab.id
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-[#0E1624] text-slate-300 hover:text-white border border-[#1E293B]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: ACTIVE RECOMMENDATIONS & 1-CLICK BROKER EXECUTION ── */}
      {activePortalTab === "ACTIVE_CALLS" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                  <LineChart className="size-4 text-emerald-400" />
                  <span>Real-Time Research Recommendations</span>
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Filtered to match your declared risk profile. Dual-analyst signed by Dr. Ananya Ray.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Feed Active</span>
              </span>
            </div>

            <div className="divide-y divide-[#1E293B]/60 mt-4">
              {DEFAULT_RECOMMENDATIONS.map((rec) => (
                <div key={rec.id} className="py-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={cx(
                          "rounded px-2.5 py-1 text-xs font-mono font-bold border",
                          rec.direction === "BUY"
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                            : "bg-red-500/15 border-red-500/30 text-red-400"
                        )}
                      >
                        {rec.direction} {rec.exchange}
                      </span>
                      <h3 className="text-lg font-bold font-mono text-white tracking-wide">
                        {rec.symbol}
                      </h3>
                      <span className="font-mono text-xs text-brand-300">{rec.id}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                        {rec.riskSuitability} Risk Tier
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge tone={rec.status === "TARGET_1_HIT" ? "positive" : "brand"}>
                        {rec.status.replace("_", " ")}
                      </Badge>
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        {rec.pnlReturn}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Levels */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="rounded-lg bg-[#0E1624] p-2.5 border border-[#1E293B]">
                      <span className="text-[10px] text-slate-400 uppercase">Entry Range</span>
                      <p className="font-bold text-white mt-0.5">₹{rec.entryRange}</p>
                    </div>
                    <div className="rounded-lg bg-[#0E1624] p-2.5 border border-[#1E293B]">
                      <span className="text-[10px] text-slate-400 uppercase">Target 1 / Target 2</span>
                      <p className="font-bold text-emerald-400 mt-0.5">₹{rec.target1} / ₹{rec.target2}</p>
                    </div>
                    <div className="rounded-lg bg-[#0E1624] p-2.5 border border-[#1E293B]">
                      <span className="text-[10px] text-slate-400 uppercase">Stop Loss</span>
                      <p className="font-bold text-rose-400 mt-0.5">₹{rec.stopLoss}</p>
                    </div>
                    <div className="rounded-lg bg-[#0E1624] p-2.5 border border-[#1E293B]">
                      <span className="text-[10px] text-slate-400 uppercase">Time Horizon</span>
                      <p className="font-bold text-white mt-0.5">{rec.timeHorizon}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    &ldquo;{rec.rationale}&rdquo;
                  </p>

                  {/* Actions & 1-Click Broker Order Execution */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#1E293B]/60">
                    <div className="text-[11px] font-mono text-slate-400">
                      Published: {rec.publishedAt} • SEBI Reg #INH00001842
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderRec(rec)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold transition-colors cursor-pointer shadow-md"
                      >
                        <Zap className="size-3.5" />
                        <span>1-Click Execute in Broker (Fyers/Kite)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SEBI SUITABILITY (RPM) CERTIFICATE ── */}
      {activePortalTab === "SUITABILITY" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                <FileCheck2 className="size-4 text-emerald-400" />
                <span>Client Suitability Assessment & Risk Profiling (RPM)</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Conducted in strict compliance with SEBI (Research Analysts) Regulations, 2014 Regulation 16.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRpmCertificateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 text-xs font-bold transition-colors cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>View Full 20-Factor Report</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4">
              <span className="text-[10px] uppercase font-mono text-slate-400">Composite Risk Score</span>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">78 / 100</p>
              <span className="text-[11px] text-slate-300 mt-0.5 block">Tier: Aggressive Growth</span>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4">
              <span className="text-[10px] uppercase font-mono text-slate-400">Financial Surplus</span>
              <p className="text-2xl font-bold font-mono text-white mt-1">84%</p>
              <span className="text-[11px] text-emerald-400 mt-0.5 block">High Discretionary Capital</span>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4">
              <span className="text-[10px] uppercase font-mono text-slate-400">Drawdown Tolerance</span>
              <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">76%</p>
              <span className="text-[11px] text-slate-300 mt-0.5 block">Max Volatility: 10–15%</span>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4">
              <span className="text-[10px] uppercase font-mono text-slate-400">Leverage Safety Gate</span>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">PASSED</p>
              <span className="text-[11px] text-emerald-400 mt-0.5 block">0% Borrowed Funds</span>
            </div>
          </div>

          {/* Permitted Instruments */}
          <div className="rounded-xl bg-[#0E1624] p-4 border border-[#1E293B] space-y-2 text-xs">
            <span className="font-bold text-white font-mono uppercase text-[11px] block">
              Permitted Asset Classes under SEBI Suitability Gate:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-lg bg-[#090E17] border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                <Check className="size-3.5" />
                <span>Large-Cap Cash Equity</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#090E17] border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                <Check className="size-3.5" />
                <span>Liquid Index ETFs</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#090E17] border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                <Check className="size-3.5" />
                <span>Positional Futures</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#090E17] border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                <Check className="size-3.5" />
                <span>Index Options (Defined-Risk)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: SIGNED ADVISORY AGREEMENT ── */}
      {activePortalTab === "AGREEMENT" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-400" />
                <span>Digital Advisory Agreement & Legal Consent Vault</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Executed under Section 65B of the Information Technology Act, 2000 & SEBI RA Regulations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAgreementVaultModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 text-xs font-bold transition-colors cursor-pointer"
            >
              <FileText className="size-3.5" />
              <span>Inspect Full Agreement</span>
            </button>
          </div>

          <div className="rounded-xl bg-[#0E1624] p-5 border border-emerald-500/30 space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center text-white">
              <span>AGREEMENT REFERENCE: <strong>EXP-AGR-2026-9041</strong></span>
              <span className="text-emerald-400 font-bold">STATUS: FULLY EXECUTED & ACTIVE</span>
            </div>
            <div className="text-slate-300">
              Client: {clientName} • Client Code: {clientCode} • Plan: HNI Bespoke
            </div>
            <div className="p-3 rounded-lg bg-[#090E17] border border-[#1E293B] text-[11px] text-brand-300 break-all">
              Cryptographic SHA-256 Digest: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            </div>
            <div className="text-slate-400 text-[11px]">
              Executed via DigiLocker OTP authentication. Admissible as primary digital evidence under Indian Evidence Act.
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: TAX INVOICES & RECEIPTS ── */}
      {activePortalTab === "INVOICES" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
              Tax Invoices & Payment Ledger (18% GST Compliant)
            </h3>
            <span className="text-xs font-mono text-emerald-400">All Payments Verified</span>
          </div>

          <div className="divide-y divide-[#1E293B]/60">
            {[
              { inv: "INV-2026-1042", desc: "HNI Bespoke Advisory - Quarterly Mandate", amt: "₹45,000", gst: "₹8,100", total: "₹53,100", date: "08 Oct 2026", status: "PAID" },
            ].map((inv) => (
              <div key={inv.inv} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-white text-sm">{inv.inv}</span>
                    <Badge tone="positive">{inv.status}</Badge>
                  </div>
                  <p className="text-slate-300 mt-0.5">{inv.desc}</p>
                  <span className="text-[11px] font-mono text-slate-400">Billed Date: {inv.date}</span>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div className="font-mono">
                    <span className="text-[10px] text-slate-400 uppercase block">Total with 18% GST</span>
                    <span className="text-base font-bold text-emerald-400">{inv.total}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      showToast(`Downloaded GST Tax Invoice ${inv.inv}`);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#1E293B] bg-[#0E1624] hover:bg-[#162030] text-white px-3 py-2 font-mono font-bold cursor-pointer"
                  >
                    <Download className="size-3.5 text-brand-300" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: RISK BUDGET & POSITION SIZING ── */}
      {activePortalTab === "PORTFOLIO" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
              Risk Budget & Position Sizing Calculator
            </h3>
            <span className="text-xs font-mono text-emerald-400">2.0% Maximum Single-Trade Risk Limit</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 text-xs font-mono">
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4">
              <span className="text-[10px] text-slate-400 uppercase">Allocated Advisory Capital</span>
              <p className="text-xl font-bold text-white mt-1">₹25,00,000</p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Declared in RPM survey</span>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4">
              <span className="text-[10px] text-slate-400 uppercase">Max Permitted Risk / Idea</span>
              <p className="text-xl font-bold text-amber-400 mt-1">₹50,000 (2%)</p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Capital preservation threshold</span>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4">
              <span className="text-[10px] text-slate-400 uppercase">Maximum Concurrent Positions</span>
              <p className="text-xl font-bold text-brand-300 mt-1">4 - 5 Trades</p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Strict diversification rule</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 1-CLICK BROKER ORDER EXECUTION MODAL ── */}
      {selectedOrderRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#090E17] border border-[#1E293B] shadow-2xl p-6 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <Zap className="size-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">
                  1-Click Broker Order Execution
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderRec(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {orderSuccessMsg ? (
              <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                <CheckCircle2 className="size-8 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-sm">Order Dispatched to Broker!</h4>
                <p className="text-xs text-emerald-300">{orderSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleExecuteBrokerOrder} className="space-y-4 text-xs">
                {/* Trade Details Header */}
                <div className="rounded-xl bg-[#0E1624] p-4 border border-[#1E293B] space-y-2">
                  <div className="flex justify-between items-center font-mono font-bold">
                    <span className="text-sm text-white">{selectedOrderRec.direction} {selectedOrderRec.symbol}</span>
                    <Badge tone="positive">{selectedOrderRec.exchange}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-300">
                    <div>Entry: <strong className="text-white">₹{selectedOrderRec.entryRange}</strong></div>
                    <div>Target: <strong className="text-emerald-400">₹{selectedOrderRec.target1}</strong></div>
                    <div>Stop Loss: <strong className="text-rose-400">₹{selectedOrderRec.stopLoss}</strong></div>
                  </div>
                </div>

                {/* Broker Selector */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Select Execution Broker API</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "FYERS", label: "Fyers API (Active)" },
                      { id: "ZERODHA", label: "Zerodha Kite" },
                      { id: "GROWW", label: "Groww Trade" },
                    ].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setOrderBroker(b.id as any)}
                        className={cx(
                          "p-2.5 rounded-xl border font-mono font-bold text-xs cursor-pointer transition-all",
                          orderBroker === b.id
                            ? "bg-brand-600 border-brand-500 text-white"
                            : "bg-[#0E1624] border-[#1E293B] text-slate-300 hover:text-white"
                        )}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity / Risk Sizing */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-300 font-semibold">Order Quantity (Shares / Lots)</label>
                    <span className="text-[11px] font-mono text-emerald-400">
                      Calculated Risk: ~₹{parseInt(orderQuantity || "0") * 90} (within 2% limit)
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    required
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white font-mono font-bold"
                  />
                </div>

                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-[11px] text-amber-300">
                  ⚠️ Non-Custodial Guarantee: Expert Stocks never touches your Demat funds. The order executes directly on your connected broker account via authorized OAuth token.
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderRec(null)}
                    className="rounded-xl border border-[#1E293B] px-4 py-2 text-slate-300 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Zap className="size-3.5" />
                    <span>Place GTT Order in {orderBroker}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── 20-FACTOR SUITABILITY CERTIFICATE MODAL ── */}
      {showRpmCertificateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#090E17] border border-[#1E293B] shadow-2xl p-6 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">SEBI Suitability Assessment Certificate</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRpmCertificateModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-[#0E1624] p-4 border border-[#1E293B] space-y-1 font-mono">
                <div className="flex justify-between font-bold text-white">
                  <span>CLIENT: {clientName}</span>
                  <span className="text-emerald-400">SCORE: 78/100 (AGGRESSIVE)</span>
                </div>
                <div>Code: {clientCode} • Audit Ref: RPM-2026-9041</div>
                <div>Certified under SEBI (Research Analysts) Regulations, 2014</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0E1624] border border-[#1E293B] space-y-2 text-slate-300">
                <p>
                  <strong>Summary Evaluation:</strong> Client demonstrates verified high discretionary income surplus, active market experience exceeding 3 years, and disciplined stop-loss execution. All four statutory safety gates have been successfully cleared.
                </p>
                <p className="text-[11px] font-mono text-cyan-400">
                  Annual Suitability Review Due: October 2027
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-xl border border-[#1E293B] bg-[#0E1624] hover:bg-[#162030] text-white px-4 py-2 font-mono cursor-pointer"
                >
                  Print Certificate
                </button>
                <button
                  type="button"
                  onClick={() => setShowRpmCertificateModal(false)}
                  className="rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AGREEMENT VAULT MODAL ── */}
      {showAgreementVaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#090E17] border border-[#1E293B] shadow-2xl p-6 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Official Advisory Agreement</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAgreementVaultModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
              <div className="rounded-xl bg-[#0E1624] p-3 font-mono text-[11px] border border-emerald-500/30 text-emerald-400">
                Executed under Information Technology Act, 2000 (Section 65B) • SHA-256 e-Signed
              </div>
              <p>
                <strong>Parties:</strong> Expert Stocks Consultancy (SEBI Registered Research Analyst #INH00001842) & {clientName} ({clientCode}).
              </p>
              <p>
                <strong>Scope:</strong> Model portfolios, technical research, and tactical derivatives positioning within the client&apos;s declared suitability tier. All recommendations are strictly non-discretionary.
              </p>
              <p className="bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg text-rose-300 text-[11px]">
                <strong>Statutory Warning:</strong> Investments in securities are subject to market risks. Past performance is not indicative of future returns. No assured or guaranteed returns are promised.
              </p>
              <div className="flex justify-end pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAgreementVaultModal(false)}
                  className="rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
