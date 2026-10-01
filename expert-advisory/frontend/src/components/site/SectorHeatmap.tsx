"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, Layers, ArrowRight, Activity } from "lucide-react";
import Link from "next/link";
import { Container, Eyebrow } from "../ui";

interface SectorData {
  id: string;
  name: string;
  change: string;
  isPositive: boolean;
  weight: string;
  breadth: string;
  volumeRatio: string;
  momentum: "Bullish" | "Neutral" | "Bearish";
  topConstituents: Array<{ symbol: string; change: string; isPositive: boolean }>;
  summary: string;
  researchSlug: string;
}

const SECTORS: SectorData[] = [
  {
    id: "banking",
    name: "NIFTY BANKING",
    change: "+1.42%",
    isPositive: true,
    weight: "34.2%",
    breadth: "88% Advancing (10 of 12)",
    volumeRatio: "1.45x 20D Avg",
    momentum: "Bullish",
    topConstituents: [
      { symbol: "HDFCBANK", change: "+1.65%", isPositive: true },
      { symbol: "ICICIBANK", change: "+1.80%", isPositive: true },
      { symbol: "SBIN", change: "+0.95%", isPositive: true },
      { symbol: "KOTAKBANK", change: "+0.70%", isPositive: true },
    ],
    summary:
      "Private and PSU banks experiencing synchronized fund inflows. Margin stability and healthy credit disbursement provide support for index breakout.",
    researchSlug: "/research?sector=banking",
  },
  {
    id: "it",
    name: "NIFTY IT",
    change: "+0.88%",
    isPositive: true,
    weight: "16.8%",
    breadth: "70% Advancing (7 of 10)",
    volumeRatio: "1.10x 20D Avg",
    momentum: "Bullish",
    topConstituents: [
      { symbol: "TCS", change: "+0.65%", isPositive: true },
      { symbol: "INFY", change: "+1.15%", isPositive: true },
      { symbol: "HCLTECH", change: "+1.40%", isPositive: true },
      { symbol: "WIPRO", change: "-0.20%", isPositive: false },
    ],
    summary:
      "Large-cap tech stabilizing after multi-quarter valuation derating. Discretionary spending recovery signals from US BFSI client commentaries.",
    researchSlug: "/research?sector=it",
  },
  {
    id: "auto",
    name: "NIFTY AUTO",
    change: "+1.16%",
    isPositive: true,
    weight: "8.5%",
    breadth: "85% Advancing (12 of 14)",
    volumeRatio: "1.32x 20D Avg",
    momentum: "Bullish",
    topConstituents: [
      { symbol: "TATAMOTORS", change: "+1.85%", isPositive: true },
      { symbol: "M&M", change: "+1.40%", isPositive: true },
      { symbol: "MARUTI", change: "+0.75%", isPositive: true },
      { symbol: "BAJAJ-AUTO", change: "+0.90%", isPositive: true },
    ],
    summary:
      "Festive season order books and SUV segment market-share expansion drive momentum. Premiumization tailwinds outpace input cost pressures.",
    researchSlug: "/research?sector=auto",
  },
  {
    id: "energy",
    name: "NIFTY ENERGY",
    change: "+0.72%",
    isPositive: true,
    weight: "13.2%",
    breadth: "62% Advancing (5 of 8)",
    volumeRatio: "0.95x 20D Avg",
    momentum: "Neutral",
    topConstituents: [
      { symbol: "RELIANCE", change: "+1.15%", isPositive: true },
      { symbol: "ONGC", change: "-0.40%", isPositive: false },
      { symbol: "NTPC", change: "+0.85%", isPositive: true },
      { symbol: "POWERGRID", change: "+0.50%", isPositive: true },
    ],
    summary:
      "Power transmission capex remains elevated; upstream exploration counters OPEC+ production quota adjustments.",
    researchSlug: "/research?sector=energy",
  },
  {
    id: "realty",
    name: "NIFTY REALTY",
    change: "+1.74%",
    isPositive: true,
    weight: "3.2%",
    breadth: "90% Advancing (9 of 10)",
    volumeRatio: "1.65x 20D Avg",
    momentum: "Bullish",
    topConstituents: [
      { symbol: "DLF", change: "+2.10%", isPositive: true },
      { symbol: "GODREJPROP", change: "+1.95%", isPositive: true },
      { symbol: "LODHA", change: "+1.45%", isPositive: true },
      { symbol: "OBEROIRLTY", change: "+1.20%", isPositive: true },
    ],
    summary:
      "Strongest relative strength sector with multi-year residential pre-sales records and debt reduction across Tier-1 developers.",
    researchSlug: "/research?sector=realty",
  },
  {
    id: "pharma",
    name: "NIFTY PHARMA",
    change: "-0.23%",
    isPositive: false,
    weight: "5.8%",
    breadth: "40% Advancing (8 of 20)",
    volumeRatio: "0.85x 20D Avg",
    momentum: "Neutral",
    topConstituents: [
      { symbol: "SUNPHARMA", change: "+0.30%", isPositive: true },
      { symbol: "DRREDDY", change: "-0.65%", isPositive: false },
      { symbol: "CIPLA", change: "-0.45%", isPositive: false },
      { symbol: "DIVISLAB", change: "+0.10%", isPositive: true },
    ],
    summary:
      "Consolidating near all-time high resistance band. US FDA compliance inspection outcomes dictate stock-specific divergence.",
    researchSlug: "/research?sector=pharma",
  },
  {
    id: "fmcg",
    name: "NIFTY FMCG",
    change: "-0.14%",
    isPositive: false,
    weight: "9.2%",
    breadth: "42% Advancing (6 of 15)",
    volumeRatio: "0.78x 20D Avg",
    momentum: "Neutral",
    topConstituents: [
      { symbol: "ITC", change: "-0.25%", isPositive: false },
      { symbol: "HINDUNILVR", change: "+0.15%", isPositive: true },
      { symbol: "NESTLEIND", change: "-0.40%", isPositive: false },
      { symbol: "BRITANNIA", change: "+0.35%", isPositive: true },
    ],
    summary:
      "Defensive positioning underperforms high-beta sectors in trending markets. Rural volume growth shows gradual sequential uptick.",
    researchSlug: "/research?sector=fmcg",
  },
];

export function SectorHeatmap() {
  const [selectedSector, setSelectedSector] = useState<SectorData>(SECTORS[0]);

  return (
    <section id="sector-pulse" className="relative py-24 lg:py-32 bg-[#05070B] border-b border-[#1C2734]">
      <Container>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <Eyebrow className="mb-3">Market Breadth Intelligence</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight">
              Sector Pulse & Relative Strength
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] max-w-2xl leading-relaxed">
              Institutional capital moves across sectors in structured rotation cycles. Analyze breadth, volume surge ratios, and top constituent leadership.
            </p>
          </div>
          <div className="text-xs font-mono text-[#667383]">
            Click any sector to inspect constituents
          </div>
        </div>

        {/* Heatmap Grid & Detail Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Heatmap Grid Blocks (7 cols) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SECTORS.map((sector) => {
              const isSelected = selectedSector.id === sector.id;

              return (
                <button
                  key={sector.id}
                  onClick={() => setSelectedSector(sector)}
                  className={`group relative rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "border-[#43D9FF] bg-[#111923] shadow-[0_0_25px_rgba(67,217,255,0.15)]"
                      : "border-[#1C2734] bg-[#0D131C] hover:border-[#283749] hover:bg-[#111923]/60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold font-display text-[#F5F7FA]">
                      {sector.name}
                    </span>
                    <span
                      className={`inline-flex items-center text-xs font-mono font-semibold ${
                        sector.isPositive ? "text-[#22C55E]" : "text-[#F05252]"
                      }`}
                    >
                      {sector.isPositive ? (
                        <ArrowUpRight className="size-3" />
                      ) : (
                        <ArrowDownRight className="size-3" />
                      )}
                      {sector.change}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-[#667383]">
                    <span>Wt: {sector.weight}</span>
                    <span className="text-[#9AA7B5]">{sector.momentum}</span>
                  </div>

                  {/* Volume Ratio Bar */}
                  <div className="mt-2 h-1 w-full bg-[#080D14] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        sector.isPositive ? "bg-[#22C55E]" : "bg-[#F05252]"
                      }`}
                      style={{
                        width: `${Math.min(100, parseFloat(sector.volumeRatio) * 65)}%`,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Sector Profile Inspector (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-[#1C2734] bg-[#0D131C] p-6 lg:p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#1C2734] pb-4 mb-5">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#43D9FF]">
                    SECTOR PROFILE
                  </div>
                  <h3 className="text-xl font-bold font-display text-[#F5F7FA] mt-0.5">
                    {selectedSector.name}
                  </h3>
                </div>
                <div
                  className={`px-3 py-1 rounded-md text-xs font-mono font-bold ${
                    selectedSector.isPositive
                      ? "bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30"
                      : "bg-[#F05252]/15 text-[#F05252] border border-[#F05252]/30"
                  }`}
                >
                  {selectedSector.change}
                </div>
              </div>

              {/* Sector Stats Matrix */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono mb-5">
                <div className="rounded-lg bg-[#080D14] p-3 border border-[#1C2734]">
                  <div className="text-[10px] text-[#667383]">MARKET BREADTH</div>
                  <div className="text-[#F5F7FA] font-semibold mt-0.5">{selectedSector.breadth}</div>
                </div>
                <div className="rounded-lg bg-[#080D14] p-3 border border-[#1C2734]">
                  <div className="text-[10px] text-[#667383]">VOLUME MULTIPLE</div>
                  <div className="text-[#43D9FF] font-semibold mt-0.5">{selectedSector.volumeRatio}</div>
                </div>
              </div>

              {/* Top Constituents List */}
              <div className="mb-5">
                <div className="text-[11px] font-mono text-[#9AA7B5] mb-2 font-semibold">
                  TOP CONSTITUENTS PERFORMANCE:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selectedSector.topConstituents.map((c) => (
                    <div
                      key={c.symbol}
                      className="flex items-center justify-between rounded-md bg-[#111923] px-3 py-2 border border-[#1C2734] text-xs font-mono"
                    >
                      <span className="font-semibold text-[#F5F7FA]">{c.symbol}</span>
                      <span className={c.isPositive ? "text-[#22C55E]" : "text-[#F05252]"}>
                        {c.change}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Research Summary */}
              <p className="text-xs text-[#9AA7B5] leading-relaxed font-sans bg-[#080D14] p-3.5 rounded-lg border border-[#1C2734]">
                {selectedSector.summary}
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-[#1C2734]">
              <Link
                href={selectedSector.researchSlug}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#111923] border border-[#1C2734] px-4 py-2.5 text-xs font-semibold text-[#F5F7FA] hover:border-[#43D9FF] hover:text-[#43D9FF] transition-all"
              >
                <span>Read Sector Research Note</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
