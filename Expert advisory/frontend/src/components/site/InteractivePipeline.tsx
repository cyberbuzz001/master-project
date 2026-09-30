"use client";

import { useState } from "react";
import { BarChart3, BookOpenCheck, CheckCircle2, Database, FileCheck2, Lock, ShieldCheck, Sparkles } from "lucide-react";

interface PipelineStage {
  id: number;
  icon: typeof Database;
  title: string;
  badge: string;
  tagline: string;
  description: string;
  checks: string[];
}

const STAGES: PipelineStage[] = [
  {
    id: 1,
    icon: Database,
    title: "Licensed Market Data",
    badge: "Exchange Grade",
    tagline: "Every tick and bar is cryptographically timestamped",
    description:
      "Data feeds are ingested via authorized exchange APIs (NSE/BSE). No unverified scrapers or crowd-sourced prices are permitted into the research engine.",
    checks: ["Direct exchange tick validation", "Timestamped historical OHLCV integrity", "Automatic stale data circuit-breaker"],
  },
  {
    id: 2,
    icon: BarChart3,
    title: "Deterministic Engine",
    badge: "Audited Math",
    tagline: "Mathematical calculation runs on tested, immutable code",
    description:
      "RSI, MACD, Moving Averages, Volatility ATR, and support-resistance pivots are computed mathematically in code without subjective manipulation.",
    checks: ["100% deterministic test coverage", "Zero AI generation of core calculations", "Cross-verified multi-timeframe indicators"],
  },
  {
    id: 3,
    icon: Sparkles,
    title: "AI Compliance Guardian",
    badge: "DPDP & SEBI Gate",
    tagline: "AI assists with narrative drafting while safety filters enforce rules",
    description:
      "Our Compliance Guardian AI scans draft reports to automatically block promissory statements ('guaranteed returns', 'sure-shot jackpot') and verify data grounding.",
    checks: ["Automated ban on prohibited guarantee phrases", "Grounding check against ingested market prices", "Mandatory risk disclosure attachment"],
  },
  {
    id: 4,
    icon: FileCheck2,
    title: "Authorized RA Sign-off",
    badge: "Human Authority",
    tagline: "Dual-control: maker cannot be the sole approver",
    description:
      "SEBI regulations mandate that research must be verified by a qualified Research Analyst (NISM Series XV certified) who did not author the original draft.",
    checks: ["Separation of duties enforcement", "NISM Series XV certification verification", "Digitally signed approval log"],
  },
  {
    id: 5,
    icon: BookOpenCheck,
    title: "Immutable Distribution",
    badge: "5-Year Audit Trail",
    tagline: "SHA-256 version locked, broadcast strictly via consent",
    description:
      "Published reports receive a permanent SHA-256 hash. Any post-publication edit requires an incremented version number with full change logs.",
    checks: ["SHA-256 cryptographic document seal", "Fail-closed consent verification for dispatches", "Statutory 5-year immutable SEBI archive"],
  },
];

export function InteractivePipeline() {
  const [activeStage, setActiveStage] = useState(0);
  const current = STAGES[activeStage];

  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Governance & Traceability</span>
          <h3 className="text-xl font-bold tracking-tight text-ink-950">How every research report is engineered</h3>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
          <ShieldCheck className="size-3.5" />
          <span>5-Stage Quality Gate</span>
        </div>
      </div>

      {/* Stepper Buttons */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STAGES.map((stage, idx) => {
          const isSelected = activeStage === idx;
          const isPassed = idx < activeStage;
          const Icon = stage.icon;

          return (
            <button
              key={stage.title}
              onClick={() => setActiveStage(idx)}
              className={`group relative flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all ${
                isSelected
                  ? "bg-brand-600 text-white shadow-md ring-2 ring-brand-600 ring-offset-2"
                  : "bg-ink-50 text-ink-700 hover:bg-ink-100/80 hover:text-ink-950"
              }`}
            >
              <div
                className={`grid size-9 place-items-center rounded-lg transition-colors ${
                  isSelected ? "bg-white/20 text-white" : "bg-white text-brand-600 ring-1 ring-ink-200/60"
                }`}
              >
                <Icon className="size-4" />
              </div>
              <span className="text-xs font-semibold leading-tight">{stage.title}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  isSelected ? "bg-white/20 text-brand-100" : "bg-ink-200/60 text-ink-600"
                }`}
              >
                Stage 0{stage.id}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Stage Deep Dive Card */}
      <div className="relative mt-6 overflow-hidden rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/70 via-white to-teal-50/30 p-5 sm:p-6 transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-brand-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
              Stage 0{current.id} of 05
            </span>
            <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
              {current.badge}
            </span>
          </div>
          <span className="text-xs font-mono text-ink-500">Automated Audit Logged</span>
        </div>

        <h4 className="mt-3 text-lg font-bold text-ink-950">{current.tagline}</h4>
        <p className="mt-2 text-sm leading-6 text-ink-700">{current.description}</p>

        {/* Verification Checkmarks */}
        <div className="mt-4 border-t border-brand-100/80 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-600">Verification & Controls</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {current.checks.map((check) => (
              <li key={check} className="flex items-start gap-2 rounded-lg bg-white/90 p-2 text-xs font-medium text-ink-800 shadow-sm ring-1 ring-ink-200/50">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 mt-0.5" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
