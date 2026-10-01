"use client";

import { useState } from "react";
import { Check, Database, Filter, Cpu, UserCheck, FileCheck } from "lucide-react";
import { Container, Eyebrow } from "../ui";

export function ResearchProcess() {
  const [activeStep, setActiveStep] = useState(2); // Default to Analysis stage

  const stages = [
    {
      step: "01",
      name: "DATA INGESTION",
      short: "DATA",
      icon: Database,
      lead: "Raw tick feeds, corporate filings & macro indicators",
      details:
        "Licensed direct exchange tick streams, corporate financial statements from BSE/NSE, macroeconomic releases and sector indices ingested with millisecond timestamps.",
      auditMetric: "Ingestion Latency: <12ms · Zero Repaint Buffer",
    },
    {
      step: "02",
      name: "DETERMINISTIC VALIDATION",
      short: "VALIDATION",
      icon: Filter,
      lead: "Automated anomaly filters & data integrity checks",
      details:
        "Tick outliers, corporate action adjustments (splits, bonuses, dividends) and liquidity threshold gates are deterministically processed before any modeling begins.",
      auditMetric: "Data Cleanse: 100% Automated · Integrity Checksum Validated",
    },
    {
      step: "03",
      name: "QUANTITATIVE ANALYSIS",
      short: "ANALYSIS",
      icon: Cpu,
      lead: "Multi-timeframe models, volatility bands & DCF bounds",
      details:
        "Technical structures (market structure, liquidity sweeps, momentum divergence) and fundamental solvency models generate candidate opportunities with mathematical bounds.",
      auditMetric: "Dual Model Concurrence: Technical + Solvency Bounds",
    },
    {
      step: "04",
      name: "AUTHORIZED HUMAN REVIEW",
      short: "REVIEW",
      icon: UserCheck,
      lead: "Senior research analyst verification & risk sign-off",
      details:
        "Every candidate setup is independently audited by an authorized research analyst who confirms the invalidation stop-loss, risk-reward ratio (>1:2), and event horizon.",
      auditMetric: "Dual-Control Sign-off: Independent Risk Invalidation Verified",
    },
    {
      step: "05",
      name: "PUBLICATION & DISCLOSURES",
      short: "PUBLISH",
      icon: FileCheck,
      lead: "Immutable timestamping & statutory disclaimer packaging",
      details:
        "Approved research is cryptographically stamped, locked against post-facto edits, bundled with mandatory SEBI disclosures and dispatched to the client portal archive.",
      auditMetric: "Audit Trail: SHA-256 Immutability · SEBI Mandate Disclosed",
    },
  ];

  return (
    <section className="relative py-16 lg:py-24 bg-[#05070B] border-b border-[#1C2734]">
      <Container>
        {/* Header */}
        <div className="max-w-3xl mb-16">
          <Eyebrow className="mb-3">Quality & Governance Pipeline</Eyebrow>
          <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight text-balance">
            From market data to published research.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] leading-relaxed text-pretty">
            Research is only reliable when you can trace its methodology, timestamps, and invalidation rules. Explore our five-stage deterministic verification pipeline.
          </p>
        </div>

        {/* Horizontal Node Stepper Bar */}
        <div className="relative mb-12">
          {/* Background Connecting Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-[#1C2734] hidden md:block" />

          {/* Stepper Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
            {stages.map((stage, idx) => {
              const isActive = activeStep === idx;
              const isPast = activeStep > idx;
              const Icon = stage.icon;

              return (
                <button
                  key={stage.step}
                  onClick={() => setActiveStep(idx)}
                  className={`flex flex-col items-center text-center p-3 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#111923] border border-[#43D9FF] shadow-[0_0_20px_rgba(67,217,255,0.15)]"
                      : "bg-[#0D131C] border border-[#1C2734] hover:border-[#283749]"
                  }`}
                >
                  <div
                    className={`size-12 rounded-full grid place-items-center font-mono text-sm font-bold transition-all mb-3 ${
                      isActive
                        ? "bg-[#43D9FF] text-[#05070B] scale-110 shadow-[0_0_15px_#43D9FF]"
                        : isPast
                        ? "bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40"
                        : "bg-[#080D14] text-[#667383] border border-[#1C2734]"
                    }`}
                  >
                    {isPast ? <Check className="size-5" /> : <Icon className="size-5" />}
                  </div>

                  <span className="font-mono text-[11px] text-[#667383] block">
                    STAGE {stage.step}
                  </span>
                  <span
                    className={`font-display text-xs font-bold tracking-tight mt-0.5 ${
                      isActive ? "text-[#43D9FF]" : "text-[#F5F7FA]"
                    }`}
                  >
                    {stage.short}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Stage Detail Card */}
        <div className="rounded-2xl border border-[#1C2734] bg-[#0D131C] p-8 lg:p-10 shadow-[0_16px_36px_-10px_rgba(0,0,0,0.8)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#1C2734]">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#43D9FF] uppercase tracking-widest mb-1.5">
                <span>Stage {stages[activeStep].step} of 05</span>
                <span>•</span>
                <span>Deterministic Verification</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold font-display text-[#F5F7FA]">
                {stages[activeStep].name}
              </h3>
            </div>
            <div className="rounded-lg border border-[#1C2734] bg-[#111923] px-4 py-2 font-mono text-xs text-[#22C55E]">
              {stages[activeStep].auditMetric}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h4 className="text-base font-semibold text-[#F5F7FA] font-sans">
                {stages[activeStep].lead}
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-[#9AA7B5]">
                {stages[activeStep].details}
              </p>
            </div>
            <div className="rounded-xl border border-[#1C2734] bg-[#080D14] p-5 font-mono text-xs text-[#667383] space-y-2.5">
              <div className="flex justify-between pb-2 border-b border-[#1C2734]">
                <span>Pipeline State:</span>
                <span className="text-[#22C55E] font-semibold">Active & Continuous</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-[#1C2734]">
                <span>Governance Rule:</span>
                <span className="text-[#F5F7FA]">Immutable Audit Log</span>
              </div>
              <div className="flex justify-between">
                <span>SEBI Conflict Check:</span>
                <span className="text-[#43D9FF]">Enforced (T-30 to T+5 Blackout)</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
