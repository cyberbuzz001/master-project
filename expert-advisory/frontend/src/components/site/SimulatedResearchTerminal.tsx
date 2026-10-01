"use client";

import { useState } from "react";
import { ArrowUpRight, BarChart2, CheckCircle2, ChevronRight, Compass, ShieldCheck, Terminal as TerminalIcon } from "lucide-react";
import { Container, Eyebrow } from "../ui";

interface InstrumentData {
  symbol: string;
  name: string;
  segment: string;
  price: string;
  change: string;
  isPositive: boolean;
  high: string;
  low: string;
  vwap: string;
  volume: string;
  candles: Array<{ o: number; h: number; l: number; c: number; v: number }>;
  technical: {
    rsi: string;
    macd: string;
    vwapStatus: string;
    emaTrend: string;
    atr: string;
    support: string;
    resistance: string;
  };
  fundamental: {
    pe: string;
    sectorPe: string;
    evEbitda: string;
    roe: string;
    debtEquity: string;
    fcf: string;
  };
  risk: {
    invalidation: string;
    target1: string;
    target2: string;
    riskReward: string;
    maxRiskPerLot: string;
    timeHorizon: string;
  };
  thesis: {
    summary: string;
    catalysts: string[];
    riskFactors: string[];
    complianceNote: string;
  };
}

const INSTRUMENTS: Record<string, InstrumentData> = {
  NIFTY: {
    symbol: "NIFTY 50",
    name: "National Stock Exchange Benchmark",
    segment: "Index Futures / Cash",
    price: "25,418.50",
    change: "+0.64%",
    isPositive: true,
    high: "25,462.10",
    low: "25,320.40",
    vwap: "25,385.20",
    volume: "18.4M",
    candles: [
      { o: 25325, h: 25360, l: 25310, c: 25350, v: 45 },
      { o: 25350, h: 25375, l: 25330, c: 25340, v: 52 },
      { o: 25340, h: 25390, l: 25335, c: 25380, v: 60 },
      { o: 25380, h: 25410, l: 25365, c: 25400, v: 75 },
      { o: 25400, h: 25425, l: 25385, c: 25390, v: 50 },
      { o: 25390, h: 25435, l: 25380, c: 25420, v: 80 },
      { o: 25420, h: 25450, l: 25405, c: 25440, v: 92 },
      { o: 25440, h: 25462, l: 25415, c: 25418, v: 85 },
    ],
    technical: {
      rsi: "58.4 (Neutral Bullish)",
      macd: "+42.5 (Bullish Crossover)",
      vwapStatus: "Trading Above VWAP (+33 pts)",
      emaTrend: "Bullish Alignment (20 > 50 > 200 EMA)",
      atr: "142 pts",
      support: "25,280",
      resistance: "25,500",
    },
    fundamental: {
      pe: "22.8x",
      sectorPe: "21.5x",
      evEbitda: "14.2x",
      roe: "15.4%",
      debtEquity: "0.82",
      fcf: "₹1.48L Cr (Aggregate)",
    },
    risk: {
      invalidation: "25,240 (Below Structural Swing Low)",
      target1: "25,550",
      target2: "25,720",
      riskReward: "1 : 2.85",
      maxRiskPerLot: "₹4,460 per 25 qty",
      timeHorizon: "2 to 5 Trading Sessions",
    },
    thesis: {
      summary:
        "Index established a higher-low base at 25,320 with declining volatility. Sustained acceptance above VWAP confirms institutional accumulation before monthly expiry.",
      catalysts: [
        "FII index futures long-to-short ratio shifted from 38% to 54%",
        "Banking heavyweights showing synchronized breakout",
      ],
      riskFactors: [
        "US 10-year yield spike above 4.30%",
        "Crude oil surging past $78/bbl",
      ],
      complianceNote:
        "Research prepared for educational and systematic tracking. Analyst maintains zero proprietary positions in NIFTY 50 derivative contracts as mandated by compliance policy.",
    },
  },
  BANKNIFTY: {
    symbol: "BANK NIFTY",
    name: "High Beta Banking Sector",
    segment: "Index Derivatives",
    price: "53,890.15",
    change: "+0.72%",
    isPositive: true,
    high: "54,015.30",
    low: "53,620.00",
    vwap: "53,810.00",
    volume: "12.8M",
    candles: [
      { o: 53630, h: 53700, l: 53610, c: 53680, v: 40 },
      { o: 53680, h: 53740, l: 53650, c: 53710, v: 48 },
      { o: 53710, h: 53790, l: 53690, c: 53770, v: 62 },
      { o: 53770, h: 53840, l: 53730, c: 53820, v: 70 },
      { o: 53820, h: 53890, l: 53780, c: 53850, v: 65 },
      { o: 53850, h: 53940, l: 53810, c: 53910, v: 85 },
      { o: 53910, h: 54015, l: 53880, c: 53890, v: 78 },
    ],
    technical: {
      rsi: "62.1 (Strong Momentum)",
      macd: "+95.0 (Expanding Histogram)",
      vwapStatus: "Trading Above VWAP (+80 pts)",
      emaTrend: "Strong Bullish Slope (20 EMA: 53,410)",
      atr: "380 pts",
      support: "53,400",
      resistance: "54,200",
    },
    fundamental: {
      pe: "16.2x",
      sectorPe: "15.8x",
      evEbitda: "N/A (Financials)",
      roe: "16.8%",
      debtEquity: "N/A (CAR: 16.4%)",
      fcf: "Net Interest Margin: 3.42%",
    },
    risk: {
      invalidation: "53,380 (Below Key Demand Zone)",
      target1: "54,300",
      target2: "54,650",
      riskReward: "1 : 2.65",
      maxRiskPerLot: "₹7,650 per 15 qty",
      timeHorizon: "Swing Horizon (3-7 Sessions)",
    },
    thesis: {
      summary:
        "Credit growth remains robust at 13.8% YoY while gross NPAs have dropped to multi-year lows. Private banking constituents demonstrate accumulation on low-volume pullbacks.",
      catalysts: ["RBI liquidity stance neutrality", "Private banks outperforming PSU basket"],
      riskFactors: ["Deposit cost repricing pressure", "Unsecured retail slippage concerns"],
      complianceNote:
        "Prepared in strict adherence to research analyst guidelines. Research does not promise directional certainty.",
    },
  },
  RELIANCE: {
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd.",
    segment: "NSE Cash & F&O",
    price: "₹3,024.50",
    change: "+1.15%",
    isPositive: true,
    high: "₹3,042.00",
    low: "₹2,990.00",
    vwap: "₹3,015.00",
    volume: "6.2M",
    candles: [
      { o: 2992, h: 3005, l: 2988, c: 3000, v: 30 },
      { o: 3000, h: 3018, l: 2995, c: 3012, v: 45 },
      { o: 3012, h: 3025, l: 3008, c: 3020, v: 55 },
      { o: 3020, h: 3034, l: 3015, c: 3028, v: 65 },
      { o: 3028, h: 3042, l: 3020, c: 3024, v: 70 },
    ],
    technical: {
      rsi: "59.8 (Constructive)",
      macd: "+8.4 (Positive Divergence)",
      vwapStatus: "Above VWAP (+₹9.50)",
      emaTrend: "Price crossing above 50-day EMA",
      atr: "₹38.50",
      support: "₹2,980",
      resistance: "₹3,080",
    },
    fundamental: {
      pe: "26.4x",
      sectorPe: "24.1x",
      evEbitda: "12.8x",
      roe: "10.2%",
      debtEquity: "0.55",
      fcf: "₹38,500 Cr",
    },
    risk: {
      invalidation: "₹2,960 (Stop Loss)",
      target1: "₹3,110",
      target2: "₹3,180",
      riskReward: "1 : 3.10",
      maxRiskPerLot: "₹16,125 per 250 qty lot",
      timeHorizon: "2 to 3 Weeks (Positional)",
    },
    thesis: {
      summary:
        "Refining margins stabilizing with Jio ARPU expansion. Consolidation pattern breakout above ₹3,000 indicates reversal of multi-week corrective channel.",
      catalysts: ["Retail IPO timeline clarity", "New energy capex monetization"],
      riskFactors: ["Gross Refining Margin (GRM) volatility", "Telecom competition"],
      complianceNote:
        "Analyst holdings: Nil. Research verified through deterministic indicator model.",
    },
  },
};

export function SimulatedResearchTerminal() {
  const [activeSymbol, setActiveSymbol] = useState("NIFTY");
  const [activeTab, setActiveTab] = useState<"technical" | "fundamental" | "risk" | "thesis">("technical");

  const current = INSTRUMENTS[activeSymbol] || INSTRUMENTS["NIFTY"];

  return (
    <section id="terminal" className="relative py-24 lg:py-32 bg-[#080D14] border-b border-[#1C2734]">
      <Container>
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <Eyebrow className="mb-3">Live Terminal Sandbox</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight">
              See the research behind the decision.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] max-w-2xl leading-relaxed">
              Explore how our quantitative engine evaluates price action, fundamental solvency, and mathematical invalidation stops in real time.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#1C2734] bg-[#0D131C] px-3.5 py-1.5 text-xs font-mono text-[#9AA7B5]">
            <span className="size-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span>EXPERT-TERMINAL // v2.6.4</span>
          </div>
        </div>

        {/* Master Simulated Terminal Frame */}
        <div className="rounded-2xl border border-[#1C2734] bg-[#05070B] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden">
          {/* Terminal Chrome Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-[#1C2734] bg-[#0D131C] px-4 py-3 gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-3">
                <span className="size-2.5 rounded-full bg-[#F05252]/80" />
                <span className="size-2.5 rounded-full bg-[#F5B84B]/80" />
                <span className="size-2.5 rounded-full bg-[#22C55E]/80" />
              </div>
              <TerminalIcon className="size-4 text-[#43D9FF]" />
              <span className="text-xs font-mono font-semibold text-[#F5F7FA]">
                RESEARCH_DESK_SIMULATOR
              </span>
            </div>

            {/* Instrument Selectors */}
            <div className="flex items-center gap-1 bg-[#05070B] p-1 rounded-lg border border-[#1C2734]">
              {Object.keys(INSTRUMENTS).map((key) => {
                const item = INSTRUMENTS[key];
                const isSelected = activeSymbol === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveSymbol(key)}
                    className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                      isSelected
                        ? "bg-[#43D9FF] text-[#05070B] font-bold"
                        : "text-[#9AA7B5] hover:text-[#F5F7FA]"
                    }`}
                  >
                    {item.symbol}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instrument Price & Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 border-b border-[#1C2734] bg-[#080D14] px-6 py-4 gap-4 text-xs font-mono">
            <div>
              <div className="text-[10px] text-[#667383]">INSTRUMENT</div>
              <div className="font-bold text-[#F5F7FA] text-sm mt-0.5">{current.symbol}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#667383]">LTP / MOVEMENT</div>
              <div className="font-bold text-[#F5F7FA] text-sm mt-0.5 flex items-center gap-1">
                {current.price}
                <span className="text-[#22C55E] text-xs font-medium">{current.change}</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#667383]">VWAP</div>
              <div className="text-[#F5F7FA] mt-0.5">{current.vwap}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#667383]">DAY RANGE (L - H)</div>
              <div className="text-[#F5F7FA] mt-0.5">{current.low} - {current.high}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#667383]">SEGMENT</div>
              <div className="text-[#43D9FF] mt-0.5 truncate">{current.segment}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#667383]">TURNOVER / VOL</div>
              <div className="text-[#F5F7FA] mt-0.5">{current.volume}</div>
            </div>
          </div>

          {/* Candlestick Chart Simulation Area */}
          <div className="p-6 bg-[#05070B] border-b border-[#1C2734]">
            <div className="flex items-center justify-between text-xs font-mono text-[#667383] mb-4">
              <div className="flex items-center gap-4">
                <span className="text-[#F5F7FA] font-semibold">15-MIN TIMEFRAME</span>
                <span className="flex items-center gap-1.5 text-[#43D9FF]">
                  <span className="size-2 rounded-full bg-[#43D9FF]" /> 20 EMA
                </span>
                <span className="flex items-center gap-1.5 text-[#7C5CFF]">
                  <span className="size-2 rounded-full bg-[#7C5CFF]" /> 50 EMA
                </span>
              </div>
              <div className="text-[11px] text-[#9AA7B5]">
                Crosshair: Auto-tracked · No Repainting
              </div>
            </div>

            {/* Candlestick & Volume Chart Canvas Simulation */}
            <div className="relative h-64 sm:h-72 w-full rounded-xl border border-[#1C2734] bg-[#080D14]/80 p-4 overflow-hidden flex flex-col justify-between">
              {/* Background Technical Grid */}
              <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

              {/* Candles Track */}
              <div className="relative z-10 flex-1 flex items-end justify-around px-2 pt-4">
                {current.candles.map((candle, idx) => {
                  const isBull = candle.c >= candle.o;
                  const bodyHeight = Math.max(16, Math.abs(candle.c - candle.o) * 0.9);
                  const wickHeight = (candle.h - candle.l) * 1.1;

                  return (
                    <div key={idx} className="flex flex-col items-center group relative cursor-pointer">
                      {/* Hover Tooltip */}
                      <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[#111923] border border-[#1C2734] p-1.5 rounded text-[9px] font-mono text-[#F5F7FA] whitespace-nowrap z-20 shadow-lg">
                        O: {candle.o} | H: {candle.h} | L: {candle.l} | C: {candle.c}
                      </div>

                      {/* Upper & Lower Wick */}
                      <div
                        className="w-[1.5px] bg-[#667383]"
                        style={{ height: `${wickHeight}px` }}
                      />

                      {/* Candle Body */}
                      <div
                        className={`w-4 sm:w-6 rounded-[2px] transition-all ${
                          isBull
                            ? "bg-[#22C55E] border border-[#22C55E]"
                            : "bg-[#F05252] border border-[#F05252]"
                        }`}
                        style={{ height: `${bodyHeight}px` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Volume Bars Floor */}
              <div className="relative z-10 h-10 border-t border-[#1C2734]/70 pt-2 flex items-end justify-around px-2">
                {current.candles.map((c, i) => (
                  <div
                    key={i}
                    className="w-3 sm:w-5 bg-[#43D9FF]/30 rounded-t-sm"
                    style={{ height: `${c.v * 0.4}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Deep Research Lenses Tabs */}
          <div className="border-b border-[#1C2734] bg-[#0D131C] px-6">
            <div className="flex gap-6 text-xs font-mono font-medium">
              {[
                { id: "technical", label: "01 TECHNICAL INTELLIGENCE" },
                { id: "fundamental", label: "02 FUNDAMENTAL AUDIT" },
                { id: "risk", label: "03 RISK BOUNDS & INVALIDATION" },
                { id: "thesis", label: "04 RESEARCH THESIS & DISCLOSURES" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3.5 border-b-2 transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? "border-[#43D9FF] text-[#43D9FF] font-bold"
                      : "border-transparent text-[#9AA7B5] hover:text-[#F5F7FA]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="p-6 sm:p-8 bg-[#080D14]">
            {activeTab === "technical" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">MOMENTUM (RSI 14)</div>
                  <div className="text-sm font-bold text-[#F5F7FA] mt-1">{current.technical.rsi}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">MACD (12, 26, 9)</div>
                  <div className="text-sm font-bold text-[#22C55E] mt-1">{current.technical.macd}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">VWAP RELATIVE POSITION</div>
                  <div className="text-sm font-bold text-[#43D9FF] mt-1">{current.technical.vwapStatus}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">MOVING AVERAGE STACK</div>
                  <div className="text-sm font-bold text-[#F5F7FA] mt-1">{current.technical.emaTrend}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">VOLATILITY (ATR 14)</div>
                  <div className="text-sm font-bold text-[#F5F7FA] mt-1">{current.technical.atr}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">STRUCTURAL S/R RANGE</div>
                  <div className="text-sm font-bold text-[#F5F7FA] mt-1">
                    {current.technical.support} - {current.technical.resistance}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "fundamental" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">PRICE TO EARNINGS (P/E)</div>
                  <div className="text-sm font-bold text-[#F5F7FA] mt-1">{current.fundamental.pe}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">SECTOR BENCHMARK P/E</div>
                  <div className="text-sm font-bold text-[#9AA7B5] mt-1">{current.fundamental.sectorPe}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">EV / EBITDA MULTIPLE</div>
                  <div className="text-sm font-bold text-[#F5F7FA] mt-1">{current.fundamental.evEbitda}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">RETURN ON EQUITY (ROE)</div>
                  <div className="text-sm font-bold text-[#22C55E] mt-1">{current.fundamental.roe}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">DEBT-TO-EQUITY RATIO</div>
                  <div className="text-sm font-bold text-[#F5F7FA] mt-1">{current.fundamental.debtEquity}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">FREE CASH FLOW YIELD</div>
                  <div className="text-sm font-bold text-[#7C5CFF] mt-1">{current.fundamental.fcf}</div>
                </div>
              </div>
            )}

            {activeTab === "risk" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
                <div className="rounded-xl border border-[#F05252]/40 bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#F05252] font-semibold">MATHEMATICAL INVALIDATION (SL)</div>
                  <div className="text-sm font-bold text-[#F05252] mt-1">{current.risk.invalidation}</div>
                </div>
                <div className="rounded-xl border border-[#22C55E]/40 bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#22C55E] font-semibold">OBJECTIVE TARGET 1</div>
                  <div className="text-sm font-bold text-[#22C55E] mt-1">{current.risk.target1}</div>
                </div>
                <div className="rounded-xl border border-[#22C55E]/40 bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#22C55E] font-semibold">OBJECTIVE TARGET 2 (EXTENDED)</div>
                  <div className="text-sm font-bold text-[#22C55E] mt-1">{current.risk.target2}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">RISK TO REWARD RATIO</div>
                  <div className="text-sm font-bold text-[#F5B84B] mt-1">{current.risk.riskReward}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">MAX RISK AT INVALIDATION</div>
                  <div className="text-sm font-bold text-[#F5F7FA] mt-1">{current.risk.maxRiskPerLot}</div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                  <div className="text-[10px] text-[#667383]">RECOMMENDED TIME HORIZON</div>
                  <div className="text-sm font-bold text-[#43D9FF] mt-1">{current.risk.timeHorizon}</div>
                </div>
              </div>
            )}

            {activeTab === "thesis" && (
              <div className="space-y-4 text-xs font-sans">
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-5">
                  <h4 className="font-display text-sm font-bold text-[#F5F7FA] mb-2">
                    Executive Research Thesis
                  </h4>
                  <p className="text-[#9AA7B5] leading-relaxed">
                    {current.thesis.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                    <h5 className="font-mono text-xs font-semibold text-[#22C55E] mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5" /> Structured Catalysts
                    </h5>
                    <ul className="space-y-1.5 text-[#9AA7B5]">
                      {current.thesis.catalysts.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                    <h5 className="font-mono text-xs font-semibold text-[#F5B84B] mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5" /> Invalidation Threats
                    </h5>
                    <ul className="space-y-1.5 text-[#9AA7B5]">
                      {current.thesis.riskFactors.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl border border-[#1C2734] bg-[#111923] p-4 text-[11px] font-mono text-[#667383] leading-relaxed">
                  <span className="text-[#F5B84B] font-semibold">Statutory Compliance Disclosure: </span>
                  {current.thesis.complianceNote}
                </div>
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
