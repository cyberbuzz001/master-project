"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  LineChart,
  ShieldCheck,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Sparkles,
  Search,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { AdvisoryRecommendation } from "@/lib/crm-data";

interface AdvisoryRecommendationsViewProps {
  recommendations: AdvisoryRecommendation[];
  onCreateRecommendation?: (rec: AdvisoryRecommendation) => void;
}

export function AdvisoryRecommendationsView({
  recommendations,
  onCreateRecommendation,
}: AdvisoryRecommendationsViewProps) {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [instrumentType, setInstrumentType] = useState<AdvisoryRecommendation["instrumentType"]>("EQUITY_CASH");
  const [entryRange, setEntryRange] = useState("");
  const [target1, setTarget1] = useState("");
  const [target2, setTarget2] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [horizon, setHorizon] = useState("2-4 Months");
  const [rationale, setRationale] = useState("");

  const filtered = recommendations.filter((r) => filterType === "ALL" || r.instrumentType === filterType);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !entryRange || !stopLoss || !target1) return;

    const newRec: AdvisoryRecommendation = {
      id: `REC-2026-0${Math.floor(100 + Math.random() * 900)}`,
      symbol: symbol.toUpperCase(),
      exchange: "NSE",
      instrumentType,
      direction,
      entryRange,
      target1,
      target2: target2 || target1,
      stopLoss,
      timeHorizon: horizon,
      rationale: rationale || "Technical breakout confirmed on high relative volume.",
      advisor: "Dr. Ananya Ray",
      approvalStatus: "APPROVED",
      approvedBy: "Head of Research (SEBI Reg #INH00001842)",
      status: "ACTIVE",
      pnlReturn: "0.0%",
      publishedAt: "Today, Just now",
      complianceChecked: true,
      eligibleSegments: ["Equity Cash", "HNI Bespoke"],
    };

    if (onCreateRecommendation) onCreateRecommendation(newRec);
    setShowModal(false);
    setSymbol("");
    setEntryRange("");
    setTarget1("");
    setTarget2("");
    setStopLoss("");
    setRationale("");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              SEBI Research Desk & Advisory Distribution
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              DUAL-ANALYST SIGN-OFF ENFORCED
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Structured stock recommendations with deterministic stop-losses, target levels, and transparent performance ledger.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer shadow-md"
        >
          <Plus className="size-4" />
          <span>Draft New Stock Recommendation</span>
        </button>
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Published Calls MTD</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">18 Calls</div>
          <p className="text-[11px] text-ink-400 mt-0.5">Strict position limits</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Target Hit Strike Rate</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">77.8%</div>
          <p className="text-[11px] text-emerald-300 mt-0.5">14 of 18 targets reached</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Average Risk : Reward</span>
          <div className="text-2xl font-bold font-mono text-brand-300 mt-1">1 : 2.45</div>
          <p className="text-[11px] text-ink-400 mt-0.5">Defined stop-losses</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Audit Compliance</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">100% Pass</div>
          <p className="text-[11px] text-cyan-300 mt-0.5">Zero personal conflicts</p>
        </div>
      </div>

      {/* Active Recommendations Feed */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            Active Recommendations & Performance Ledger
          </h2>
          <div className="flex items-center gap-1 text-xs">
            {["ALL", "EQUITY_CASH", "INDEX_OPTIONS"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={cx(
                  "px-3 py-1 rounded-lg font-mono text-[10px] uppercase font-bold transition-colors cursor-pointer",
                  filterType === t ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
                )}
              >
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-[#1E293B]/60">
          {filtered.map((rec) => (
            <div key={rec.id} className="p-5 space-y-3 hover:bg-[#0E1624]/60 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className={cx(
                    "rounded px-2.5 py-1 text-xs font-mono font-bold border",
                    rec.direction === "BUY"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-red-500/15 border-red-500/30 text-red-400"
                  )}>
                    {rec.direction} {rec.exchange}
                  </span>
                  <h3 className="text-lg font-bold font-mono text-white tracking-wide">
                    {rec.symbol}
                  </h3>
                  <span className="font-mono text-xs text-brand-400">{rec.id}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className={cx(
                    "rounded-full px-3 py-0.5 text-xs font-mono font-bold",
                    rec.status === "TARGET_1_HIT"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-brand-500/20 text-brand-300 border border-brand-500/40"
                  )}>
                    {rec.status.replace("_", " ")}
                  </span>
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    {rec.pnlReturn} P&L
                  </span>
                </div>
              </div>

              {/* Levels Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="rounded-lg bg-[#0E1624] p-2.5 border border-[#1E293B]">
                  <span className="text-[10px] text-ink-400 uppercase">Entry Range</span>
                  <p className="font-bold text-white mt-0.5">{rec.entryRange}</p>
                </div>
                <div className="rounded-lg bg-[#0E1624] p-2.5 border border-[#1E293B]">
                  <span className="text-[10px] text-ink-400 uppercase">Target 1 / Target 2</span>
                  <p className="font-bold text-emerald-400 mt-0.5">{rec.target1} / {rec.target2}</p>
                </div>
                <div className="rounded-lg bg-[#0E1624] p-2.5 border border-[#1E293B]">
                  <span className="text-[10px] text-ink-400 uppercase">Stop Loss</span>
                  <p className="font-bold text-red-400 mt-0.5">{rec.stopLoss}</p>
                </div>
                <div className="rounded-lg bg-[#0E1624] p-2.5 border border-[#1E293B]">
                  <span className="text-[10px] text-ink-400 uppercase">Time Horizon</span>
                  <p className="font-bold text-white mt-0.5">{rec.timeHorizon}</p>
                </div>
              </div>

              {/* Rationale & Sign-Off */}
              <p className="text-xs text-ink-300 leading-relaxed italic">
                &quot;{rec.rationale}&quot;
              </p>

              <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-ink-400 border-t border-[#1E293B]/60 pt-2">
                <span>Published: {rec.publishedAt} • Advisor: {rec.advisor}</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="size-3.5" />
                  <span>Approved by {rec.approvedBy}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-[#090E17] border border-[#1E293B] shadow-2xl p-6 space-y-4 text-white">
            <h2 className="text-lg font-bold font-display text-white">Draft Stock Recommendation</h2>
            <form onSubmit={handlePublish} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-400 mb-1">Symbol (NSE/BSE)</label>
                  <input
                    type="text"
                    required
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="e.g. RELIANCE, TCS"
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-ink-400 mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as any)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-ink-400 mb-1">Entry Range</label>
                  <input
                    type="text"
                    required
                    value={entryRange}
                    onChange={(e) => setEntryRange(e.target.value)}
                    placeholder="1500 - 1520"
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-ink-400 mb-1">Target 1</label>
                  <input
                    type="text"
                    required
                    value={target1}
                    onChange={(e) => setTarget1(e.target.value)}
                    placeholder="1620"
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-ink-400 mb-1">Stop Loss</label>
                  <input
                    type="text"
                    required
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="1460"
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-400 mb-1">Technical / Fundamental Rationale</label>
                <textarea
                  rows={3}
                  required
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Provide technical breakout, volume verification, and risk-reward calculation..."
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white"
                />
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-[11px] text-amber-300">
                ⚠️ Statutory Certification: By submitting, the research analyst certifies zero financial conflict of interest in the security as required under SEBI (Research Analysts) Regulations, 2014.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-[#1E293B] px-4 py-2 text-ink-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 font-bold"
                >
                  Sign & Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
