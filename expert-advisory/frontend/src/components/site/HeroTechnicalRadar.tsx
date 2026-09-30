"use client";

import { useState } from "react";
import { Activity, AlertCircle, CheckCircle2, ChevronRight, Layers, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

interface AssetSetup {
  symbol: string;
  name: string;
  category: string;
  cmp: string;
  change: string;
  trend: string;
  rsi: number;
  rsiState: string;
  entryRange: string;
  target: string;
  invalidation: string;
  rewardRisk: string;
  timeframe: string;
  thesis: string;
}

const ASSET_SETUPS: AssetSetup[] = [
  {
    symbol: "NIFTY 50",
    name: "Nifty 50 Benchmark Index",
    category: "Index Structure",
    cmp: "25,418.50",
    change: "+0.64%",
    trend: "Bullish Trend Confirmation",
    rsi: 58.4,
    rsiState: "Healthy Momentum",
    entryRange: "25,320 – 25,380",
    target: "25,650 / 25,820",
    invalidation: "25,180 (Daily Close)",
    rewardRisk: "1 : 2.4",
    timeframe: "Swing (2–4 Weeks)",
    thesis: "Higher-high higher-low structure intact above 20 EMA with expanding institutional participation.",
  },
  {
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd",
    category: "Energy & Conglomerate",
    cmp: "₹3,024.00",
    change: "+1.28%",
    trend: "Ascending Channel Breakout",
    rsi: 62.1,
    rsiState: "Strong Accumulation",
    entryRange: "₹2,990 – ₹3,010",
    target: "₹3,180 / ₹3,260",
    invalidation: "₹2,920",
    rewardRisk: "1 : 2.6",
    timeframe: "Positional (4–6 Weeks)",
    thesis: "Multi-week consolidation breakout backed by heavy above-average delivery volume.",
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd",
    category: "Private Banking Core",
    cmp: "₹1,684.50",
    change: "+0.85%",
    trend: "200-Day EMA Mean Reversion",
    rsi: 51.2,
    rsiState: "Neutral / Bullish Base",
    entryRange: "₹1,660 – ₹1,675",
    target: "₹1,760 / ₹1,810",
    invalidation: "₹1,620",
    rewardRisk: "1 : 2.1",
    timeframe: "Swing (3–5 Weeks)",
    thesis: "Testing long-term volume weighted support zone with decreasing downside selling pressure.",
  },
];

export function HeroTechnicalRadar() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = ASSET_SETUPS[activeIdx];

  return (
    <div className="relative rounded-2xl border border-white/60 bg-gradient-to-b from-white/95 to-ink-50/95 p-5 sm:p-6 shadow-[0_20px_60px_-15px_rgba(11,27,46,0.12)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_25px_70px_-15px_rgba(31,86,214,0.18)]">
      {/* Decorative ambient lighting */}
      <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-brand-500/10 blur-2xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 size-48 rounded-full bg-teal-500/10 blur-2xl" aria-hidden="true" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Activity className="size-4 animate-pulse" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Technical Intelligence</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 className="size-2.5" />
                SEBI Standard Format
              </span>
            </div>
            <p className="text-[11px] text-ink-500">Deterministic Mathematical Modeling</p>
          </div>
        </div>

        {/* Symbol switcher tabs */}
        <div className="flex rounded-lg bg-ink-100/80 p-0.5 text-xs">
          {ASSET_SETUPS.map((setup, idx) => (
            <button
              key={setup.symbol}
              onClick={() => setActiveIdx(idx)}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold transition-all ${
                activeIdx === idx
                  ? "bg-white text-ink-950 shadow-sm"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              {setup.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Main Asset Header */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">{active.symbol}</h3>
            <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">{active.category}</span>
          </div>
          <p className="text-xs text-ink-500">{active.name}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold text-ink-950">{active.cmp}</div>
          <div className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-600">
            <TrendingUp className="size-3" />
            {active.change}
          </div>
        </div>
      </div>

      {/* Interactive Vector Motion Chart Canvas */}
      <div className="relative mt-4 overflow-hidden rounded-xl border border-ink-200/80 bg-gradient-to-b from-ink-950 to-ink-900 p-4 text-white shadow-inner">
        {/* Subtle grid lines */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:28px_28px]" />

        {/* Top chart metrics */}
        <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-ink-300">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
            <span>20 EMA: 25,290</span>
            <span className="text-ink-500">·</span>
            <span>50 EMA: 25,050</span>
          </span>
          <span className="rounded bg-ink-800/80 px-2 py-0.5 text-emerald-400 ring-1 ring-emerald-500/30">
            {active.trend}
          </span>
        </div>

        {/* SVG Spline Motion Graphic */}
        <div className="relative my-3 h-32 w-full sm:h-36">
          <svg className="h-full w-full overflow-visible" viewBox="0 0 400 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`gradient-${active.symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2f6bef" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#13a58f" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="lineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2f6bef" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>

            {/* Target Resistance Level (Dashed Line) */}
            <line x1="0" y1="20" x2="400" y2="20" stroke="#34d399" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.6" />
            <text x="390" y="16" fill="#34d399" fontSize="9" textAnchor="end" fontFamily="monospace">
              T1: {active.target.split("/")[0]}
            </text>

            {/* Entry Pivot Level (Dashed Line) */}
            <line x1="0" y1="65" x2="400" y2="65" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.4" />
            <text x="390" y="60" fill="#38bdf8" fontSize="9" textAnchor="end" fontFamily="monospace">
              Pivot: {active.cmp}
            </text>

            {/* Invalidation Level (Dashed Line) */}
            <line x1="0" y1="105" x2="400" y2="105" stroke="#f87171" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.5" />
            <text x="390" y="100" fill="#f87171" fontSize="9" textAnchor="end" fontFamily="monospace">
              Invalidation: {active.invalidation.split(" ")[0]}
            </text>

            {/* Gradient Fill Under Spline */}
            <path
              d="M 0 95 C 40 92, 70 102, 110 85 C 150 68, 180 82, 220 58 C 260 38, 300 52, 340 32 C 370 20, 390 24, 400 22 L 400 120 L 0 120 Z"
              fill={`url(#gradient-${active.symbol})`}
            />

            {/* Main Trend Spline with smooth curve */}
            <path
              d="M 0 95 C 40 92, 70 102, 110 85 C 150 68, 180 82, 220 58 C 260 38, 300 52, 340 32 C 370 20, 390 24, 400 22"
              fill="none"
              stroke="url(#lineGlow)"
              strokeWidth="2.75"
              strokeLinecap="round"
            />

            {/* Radar Halo Pulses on Pivots */}
            <g transform="translate(220, 58)">
              <circle r="8" fill="#38bdf8" opacity="0.3" className="animate-ping" />
              <circle r="3.5" fill="#38bdf8" />
            </g>

            {/* Active Current Price Inflection Point */}
            <g transform="translate(340, 32)">
              <circle r="12" fill="#34d399" opacity="0.25" className="animate-ping" />
              <circle r="5" fill="#34d399" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          </svg>
        </div>

        {/* Bottom Technical Indicators Strip */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-ink-800/80 pt-2.5 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="text-ink-400">RSI(14):</span>
            <span className="font-bold text-white">{active.rsi}</span>
            <span className="text-emerald-400">({active.rsiState})</span>
          </div>
          <div className="flex items-center gap-2 text-ink-300">
            <span>R:R: <strong className="text-white">{active.rewardRisk}</strong></span>
            <span>·</span>
            <span>Horizon: <strong className="text-white">{active.timeframe}</strong></span>
          </div>
        </div>
      </div>

      {/* Structural Trade Parameters Grid */}
      <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
        <div className="rounded-xl border border-ink-200/80 bg-white p-2.5 shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-ink-500">Entry Range</span>
          <p className="mt-0.5 font-mono text-xs font-bold text-ink-900">{active.entryRange}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-emerald-700">Target Scenario</span>
          <p className="mt-0.5 font-mono text-xs font-bold text-emerald-800">{active.target}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-2.5 shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-rose-700">Invalidation Level</span>
          <p className="mt-0.5 font-mono text-xs font-bold text-rose-800">{active.invalidation}</p>
        </div>
      </div>

      {/* Research Thesis Narrative */}
      <div className="mt-3.5 rounded-xl bg-ink-50/80 p-3 text-xs leading-5 text-ink-700 ring-1 ring-ink-200/60">
        <span className="font-semibold text-ink-900">Research Thesis: </span>
        {active.thesis}
      </div>

      {/* Statutory Regulatory Watermark */}
      <div className="mt-3.5 flex items-center justify-between text-[11px] text-ink-500 border-t border-ink-100 pt-2.5">
        <span className="flex items-center gap-1">
          <ShieldCheck className="size-3.5 text-teal-600" />
          <span>SEBI RA Profile: <strong>INH000012345</strong></span>
        </span>
        <span className="text-ink-400">Strictly Non-Discretionary</span>
      </div>
    </div>
  );
}
