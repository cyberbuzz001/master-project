"use client";

import { useState } from "react";
import { ArrowRight, BarChart, Layers, LineChart, Shield, Sparkles, GraduationCap } from "lucide-react";
import Link from "next/link";
import { Container, Eyebrow } from "../ui";

export function ServicesGrid() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const services = [
    {
      num: "01",
      title: "EQUITY RESEARCH",
      category: "CASH MARKET & SWING",
      desc: "Structured research reports on large and mid-cap Indian companies with deep fundamental audits and swing technical levels.",
      features: ["Multi-month horizon models", "Quarterly earnings impact analysis", "Clear invalidation stop levels"],
      icon: LineChart,
      accent: "#43D9FF",
    },
    {
      num: "02",
      title: "INDEX DERIVATIVES",
      category: "OPTIONS & FUTURES",
      desc: "Directional and delta-hedged research setups for NIFTY, BANK NIFTY and FINNIFTY with open interest (OI) structure.",
      features: ["Strike selection & risk curves", "Implied Volatility (IV) skew tracking", "Strict risk-per-lot brackets"],
      icon: Layers,
      accent: "#7C5CFF",
    },
    {
      num: "03",
      title: "STOCK F&O RESEARCH",
      category: "HIGH-LIQUIDITY SINGLE STOCKS",
      desc: "Momentum and volatility breakout research on NSE stock futures and options with volume weighted confirmation.",
      features: ["High liquidity contract screening", "Cash-Futures basis tracking", "Event-risk avoidance protocols"],
      icon: BarChart,
      accent: "#43D9FF",
    },
    {
      num: "04",
      title: "COMMODITY RESEARCH",
      category: "MCX PRECIOUS & ENERGY",
      desc: "Systematic research coverage on MCX Gold, Silver, Crude Oil, and Natural Gas aligned with global macro drivers.",
      features: ["Global currency correlation checks", "Inventory and demand-supply cycles", "Session-based breakout triggers"],
      icon: Shield,
      accent: "#F5B84B",
    },
    {
      num: "05",
      title: "BESPOKE HNI RESEARCH",
      category: "PORTFOLIO ALLOCATION DESK",
      desc: "Custom multi-asset portfolio risk audits, tail-risk hedging structures and long-term thesis development for high net-worth individuals.",
      features: ["Dedicated senior analyst briefings", "Drawdown stress-testing models", "Quarterly portfolio reviews"],
      icon: Sparkles,
      accent: "#7C5CFF",
    },
    {
      num: "06",
      title: "INVESTOR EDUCATION",
      category: "EXPERT STOCKS ACADEMY",
      desc: "Rigorous curriculum covering price action architecture, option pricing mathematics, risk management, and quantitative research methodology.",
      features: ["Deterministic indicator formulas", "Risk-first position sizing models", "Institutional trade journaling"],
      icon: GraduationCap,
      accent: "#22C55E",
    },
  ];

  return (
    <section id="services" className="relative py-24 lg:py-32 bg-[#080D14] border-b border-[#1C2734]">
      <Container>
        {/* Header */}
        <div className="max-w-3xl mb-16">
          <Eyebrow className="mb-3">Institutional Offerings</Eyebrow>
          <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight text-balance">
            Research-backed solutions across Indian asset classes.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] leading-relaxed text-pretty">
            Every service adheres strictly to documented quantitative frameworks, predefined risk parameters, and comprehensive SEBI regulatory disclosures.
          </p>
        </div>

        {/* 6 Cards Grid (3x2 Desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, idx) => {
            const isHovered = hoveredIndex === idx;
            const Icon = svc.icon;

            return (
              <div
                key={svc.num}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="group relative flex flex-col justify-between rounded-2xl border border-[#1C2734] bg-[#0D131C] p-8 transition-all duration-300 hover:-translate-y-1.5 hover:border-[#283749] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)]"
              >
                <div>
                  {/* Top Bar with Number & Icon */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xl font-bold text-[#667383] group-hover:text-[#F5F7FA] transition-colors">
                      {svc.num}
                    </span>
                    <div
                      className="grid size-10 place-items-center rounded-lg border border-[#1C2734] bg-[#111923] text-[#F5F7FA] transition-transform duration-300 group-hover:scale-110"
                      style={{ color: svc.accent }}
                    >
                      <Icon className="size-5" />
                    </div>
                  </div>

                  <div className="mt-6 text-[10px] font-mono tracking-widest text-[#43D9FF] uppercase">
                    {svc.category}
                  </div>

                  <h3 className="mt-1 text-xl font-bold tracking-tight text-[#F5F7FA] font-display">
                    {svc.title}
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-[#9AA7B5]">
                    {svc.desc}
                  </p>

                  {/* Mini Animated Chart / Vector on Hover */}
                  <div className="my-5 h-20 w-full rounded-lg border border-[#1C2734] bg-[#080D14] p-3 flex items-center justify-between overflow-hidden">
                    <div className="flex-1 flex items-end gap-1.5 h-full">
                      {[30, 45, 25, 60, 50, 75, 65, 85].map((val, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-sm transition-all duration-500"
                          style={{
                            height: isHovered ? `${val}%` : `${val * 0.6}%`,
                            backgroundColor: i % 2 === 0 ? svc.accent : "#1C2734",
                            opacity: isHovered ? 1 : 0.6,
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-right pl-3 text-[10px] font-mono text-[#667383]">
                      <div>Risk Bound</div>
                      <div className="text-[#F5F7FA] font-bold">1 : 2.5+ R:R</div>
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-1.5">
                    {svc.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-[#9AA7B5]">
                        <span className="size-1 rounded-full bg-[#43D9FF]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Explore Action */}
                <div className="mt-8 pt-4 border-t border-[#1C2734]">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#F5F7FA] group-hover:text-[#43D9FF] transition-colors"
                  >
                    <span>Explore Advisory Plan</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
