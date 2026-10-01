"use client";

import { useState } from "react";
import { ArrowRight, BarChart3, Binary, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Container, Eyebrow } from "../ui";

export function IntelligenceEngine() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const lenses = [
    {
      id: 1,
      num: "01",
      title: "TECHNICAL INTELLIGENCE",
      subtitle: "Price structure, momentum, volatility & liquidity sweeps",
      features: ["Market Structure (BOS / CHoCH)", "Momentum Oscillators & Divergence", "Volume Weighted Price (VWAP)", "Volatility Bands & ATR Envelope", "Strict Invalidation Stop Levels"],
      icon: Binary,
      accent: "#43D9FF",
      href: "/research?lens=technical",
    },
    {
      id: 2,
      num: "02",
      title: "FUNDAMENTAL INTELLIGENCE",
      subtitle: "Earnings quality, solvency, margin expansion & valuation",
      features: ["EBITDA & Net Profit Margins", "Free Cash Flow Yield (FCF)", "Return on Equity & Capital (ROE/ROCE)", "Debt-to-Equity & Interest Coverage", "Discounted Cash Flow (DCF) Bounds"],
      icon: BarChart3,
      accent: "#7C5CFF",
      href: "/research?lens=fundamental",
    },
    {
      id: 3,
      num: "03",
      title: "RISK INTELLIGENCE",
      subtitle: "Scenario analysis, capital preservation & position sizing",
      features: ["Mathematical Invalidation Thresholds", "Scenario Distribution (Bull / Base / Bear)", "Kelly Criterion Position Sizing", "Event Risk & Implied Volatility Crushes", "Horizon & Liquidity Gate Checks"],
      icon: ShieldAlert,
      accent: "#F5B84B",
      href: "/methodology#risk",
    },
  ];

  return (
    <section className="relative py-16 lg:py-24 bg-[#05070B] border-b border-[#1C2734]">
      <Container>
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <Eyebrow className="mb-3">Research Architecture</Eyebrow>
          <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight text-balance">
            Three lenses. One research framework.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] leading-relaxed text-pretty">
            Quantitative rigor requires multiple orthogonal perspectives. Every research report combines price structure, financial quality and explicit risk limits before publication.
          </p>
        </div>

        {/* 3 Large Interactive Lenses */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {lenses.map((lens) => {
            const isHovered = hoveredCard === lens.id;
            const Icon = lens.icon;

            return (
              <div
                key={lens.id}
                onMouseEnter={() => setHoveredCard(lens.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#1C2734] bg-[#0D131C] p-8 transition-all duration-300 hover:-translate-y-1.5 hover:border-[#283749] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)]"
              >
                {/* Background Ambient Glow */}
                <div
                  className="pointer-events-none absolute -right-20 -top-20 size-48 rounded-full blur-3xl transition-opacity duration-500"
                  style={{
                    backgroundColor: lens.accent,
                    opacity: isHovered ? 0.15 : 0.03,
                  }}
                  aria-hidden="true"
                />

                <div>
                  {/* Top Number & Geometric Icon */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-bold text-[#667383] group-hover:text-[#F5F7FA] transition-colors">
                      {lens.num}
                    </span>
                    <div
                      className="grid size-10 place-items-center rounded-lg border border-[#1C2734] bg-[#111923] text-[#F5F7FA] transition-transform duration-300 group-hover:scale-110"
                      style={{ color: lens.accent }}
                    >
                      <Icon className="size-5" />
                    </div>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="mt-8 text-xl font-bold tracking-tight text-[#F5F7FA] font-display">
                    {lens.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#9AA7B5]">
                    {lens.subtitle}
                  </p>

                  {/* Dynamic Interactive Visual Panel on Hover */}
                  <div className="my-6 h-36 w-full rounded-xl border border-[#1C2734] bg-[#080D14] p-3 flex flex-col justify-center overflow-hidden">
                    {lens.id === 1 && (
                      <div className="flex flex-col justify-between h-full">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#667383]">
                          <span>CANDLESTICK STRUCTURE</span>
                          <span className="text-[#43D9FF]">EMA 20/50</span>
                        </div>
                        {/* Candlestick visualization */}
                        <div className="flex items-end justify-between gap-1.5 h-20 pt-2 px-1">
                          {[
                            { h: 35, b: 20, g: true },
                            { h: 45, b: 28, g: true },
                            { h: 30, b: 18, g: false },
                            { h: 55, b: 34, g: true },
                            { h: 48, b: 24, g: false },
                            { h: 68, b: 45, g: true },
                            { h: 62, b: 38, g: false },
                            { h: 80, b: 54, g: true },
                          ].map((c, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center">
                              <div
                                className="w-[1.5px] bg-[#667383]"
                                style={{ height: `${c.h - c.b}px` }}
                              />
                              <div
                                className={`w-full rounded-[1px] transition-all duration-300 ${
                                  c.g ? "bg-[#22C55E]" : "bg-[#F05252]"
                                }`}
                                style={{
                                  height: `${c.b}px`,
                                  opacity: isHovered ? 1 : 0.75,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {lens.id === 2 && (
                      <div className="flex flex-col justify-between h-full">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#667383]">
                          <span>FINANCIAL METRICS</span>
                          <span className="text-[#7C5CFF]">QoQ GROWTH</span>
                        </div>
                        <div className="space-y-2 mt-1">
                          {[
                            { label: "OP. MARGIN", val: 78, pct: "+24.2%" },
                            { label: "ROCE RATIO", val: 65, pct: "18.5%" },
                            { label: "FCF CONV.", val: 88, pct: "92.0%" },
                          ].map((bar, i) => (
                            <div key={i} className="text-[10px] font-mono">
                              <div className="flex justify-between text-[#9AA7B5] mb-0.5">
                                <span>{bar.label}</span>
                                <span className="text-[#F5F7FA]">{bar.pct}</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-[#111923] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#7C5CFF] transition-all duration-700"
                                  style={{ width: isHovered ? `${bar.val}%` : `${bar.val * 0.7}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {lens.id === 3 && (
                      <div className="flex flex-col justify-between h-full">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#667383]">
                          <span>RISK MATRIX BOUNDS</span>
                          <span className="text-[#F5B84B]">R:R 1:3.2</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 mt-1 text-center">
                          <div className="rounded bg-[#111923] p-1.5 border border-[#1C2734]">
                            <div className="text-[9px] font-mono text-[#667383]">BEAR SL</div>
                            <div className="text-[11px] font-mono font-bold text-[#F05252]">-1.8%</div>
                          </div>
                          <div className="rounded bg-[#111923] p-1.5 border border-[#1C2734]">
                            <div className="text-[9px] font-mono text-[#667383]">BASE T1</div>
                            <div className="text-[11px] font-mono font-bold text-[#F5B84B]">+3.5%</div>
                          </div>
                          <div className="rounded bg-[#111923] p-1.5 border border-[#1C2734]">
                            <div className="text-[9px] font-mono text-[#667383]">BULL T2</div>
                            <div className="text-[11px] font-mono font-bold text-[#22C55E]">+6.2%</div>
                          </div>
                        </div>
                        <div className="text-[9px] font-mono text-[#9AA7B5] mt-1 truncate">
                          Position Cap: Max 2.5% risk per setup
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bullet Criteria */}
                  <ul className="space-y-2 mt-4">
                    {lens.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-xs text-[#9AA7B5]">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: lens.accent }}
                        />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Explore Link CTA */}
                <div className="mt-8 pt-4 border-t border-[#1C2734]/70">
                  <Link
                    href={lens.href}
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#F5F7FA] group-hover:text-[#43D9FF] transition-colors"
                  >
                    <span>Explore Methodology</span>
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
