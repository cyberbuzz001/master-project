"use client";

import { ArrowRight, BookOpen, CheckCircle, Clock, GraduationCap, Trophy } from "lucide-react";
import Link from "next/link";
import { Container, Eyebrow } from "../ui";

export function AcademySection() {
  const levels = [
    {
      tier: "LEVEL 01",
      badge: "BEGINNER",
      title: "Market Fundamentals & Mechanics",
      time: "4 Modules · 2.5 Hours",
      accent: "#43D9FF",
      desc: "Comprehensive breakdown of Indian exchange structure (NSE/BSE), T+1 settlement cycles, order types, and risk concepts.",
      topics: [
        "Auction mechanics & bid-ask spreads",
        "Market orders, Limit, SL & SL-M execution",
        "Understanding corporate actions & index weighting",
      ],
      link: "/resources#beginner",
    },
    {
      tier: "LEVEL 02",
      badge: "INTERMEDIATE",
      title: "Price Action & Structural Technicals",
      time: "6 Modules · 4 Hours",
      accent: "#7C5CFF",
      desc: "Market structure shift identification, liquidity pools, multi-timeframe alignment, and volume-weighted confirmation.",
      topics: [
        "Break of Structure (BOS) vs Change of Character",
        "VWAP & Volume Profile accumulation nodes",
        "Momentum divergence & multi-timeframe confluence",
      ],
      link: "/resources#technical",
    },
    {
      tier: "LEVEL 03",
      badge: "ADVANCED",
      title: "Derivatives & Options Volatility",
      time: "5 Modules · 5 Hours",
      accent: "#F5B84B",
      desc: "Derivatives pricing mathematics, open interest (OI) structure, volatility smile, and defined-risk spread design.",
      topics: [
        "Option Greeks (Delta, Theta, Vega, Gamma)",
        "Open interest concentration & PCR interpretation",
        "Hedging directional exposure via debit/credit spreads",
      ],
      link: "/resources#derivatives",
    },
    {
      tier: "LEVEL 04",
      badge: "PRO / INSTITUTIONAL",
      title: "Quantitative Methodology & Risk Systems",
      time: "4 Modules · 3.5 Hours",
      accent: "#22C55E",
      desc: "Deterministic indicator formulation, maximum drawdown controls, Kelly position sizing, and trade journaling.",
      topics: [
        "Mathematical invalidation thresholds",
        "Monte Carlo risk simulations & ruin probability",
        "SEBI research compliance & conflict management",
      ],
      link: "/resources#risk-management",
    },
  ];

  return (
    <section id="academy" className="relative py-24 lg:py-32 bg-[#080D14] border-b border-[#1C2734]">
      <Container>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-16">
          <div>
            <Eyebrow className="mb-3">Institutional Education</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight">
              Expert Stocks Academy
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] max-w-2xl leading-relaxed">
              A structured progression from market mechanics to advanced quantitative derivatives and disciplined risk management.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#1C2734] bg-[#0D131C] px-3.5 py-1.5 text-xs font-mono text-[#9AA7B5]">
            <GraduationCap className="size-4 text-[#43D9FF]" />
            <span>Open Access Curriculum</span>
          </div>
        </div>

        {/* 4 Levels Horizontal Progression Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {levels.map((lvl) => (
            <div
              key={lvl.tier}
              className="group flex flex-col justify-between rounded-2xl border border-[#1C2734] bg-[#0D131C] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-[#283749] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)]"
            >
              <div>
                {/* Level Badge Header */}
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs text-[#667383]">{lvl.tier}</span>
                  <span
                    className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border"
                    style={{
                      color: lvl.accent,
                      backgroundColor: `${lvl.accent}15`,
                      borderColor: `${lvl.accent}30`,
                    }}
                  >
                    {lvl.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold font-display text-[#F5F7FA] tracking-tight group-hover:text-[#43D9FF] transition-colors">
                  {lvl.title}
                </h3>

                <div className="mt-2 flex items-center gap-1.5 text-xs font-mono text-[#667383]">
                  <Clock className="size-3 text-[#9AA7B5]" />
                  <span>{lvl.time}</span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-[#9AA7B5]">
                  {lvl.desc}
                </p>

                {/* Topic Points */}
                <ul className="mt-5 space-y-2 pt-4 border-t border-[#1C2734]">
                  {lvl.topics.map((t, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-[#9AA7B5]">
                      <CheckCircle className="size-3.5 text-[#43D9FF] shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-[#1C2734]">
                <Link
                  href={lvl.link}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F5F7FA] group-hover:text-[#43D9FF] transition-colors"
                >
                  <span>Start Curriculum</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
