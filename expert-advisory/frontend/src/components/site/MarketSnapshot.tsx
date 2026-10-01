"use client";

import { useState, useEffect } from "react";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { Container } from "../ui";

interface MarketItem {
  id: string;
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
  high: string;
  low: string;
  sparkline: number[];
}

const INITIAL_MARKETS: MarketItem[] = [
  {
    id: "nifty",
    symbol: "NIFTY 50",
    name: "NSE Benchmark Index",
    price: "25,418.50",
    change: "+0.64%",
    isPositive: true,
    high: "25,462.10",
    low: "25,320.40",
    sparkline: [25320, 25350, 25340, 25390, 25370, 25440, 25418],
  },
  {
    id: "sensex",
    symbol: "SENSEX",
    name: "BSE 30 Core",
    price: "83,184.80",
    change: "+0.58%",
    isPositive: true,
    high: "83,310.00",
    low: "82,920.15",
    sparkline: [82920, 83010, 82980, 83120, 83090, 83220, 83184],
  },
  {
    id: "banknifty",
    symbol: "BANK NIFTY",
    name: "High Beta Banking",
    price: "53,890.15",
    change: "+0.72%",
    isPositive: true,
    high: "54,015.30",
    low: "53,620.00",
    sparkline: [53620, 53710, 53690, 53820, 53790, 53950, 53890],
  },
  {
    id: "indiavix",
    symbol: "INDIA VIX",
    name: "Market Volatility",
    price: "12.42",
    change: "-3.25%",
    isPositive: false,
    high: "12.95",
    low: "12.30",
    sparkline: [12.85, 12.92, 12.70, 12.60, 12.55, 12.40, 12.42],
  },
  {
    id: "niftyit",
    symbol: "NIFTY IT",
    name: "Technology Sector",
    price: "42,310.20",
    change: "+0.88%",
    isPositive: true,
    high: "42,480.00",
    low: "41,950.00",
    sparkline: [41950, 42080, 42040, 42190, 42150, 42350, 42310],
  },
  {
    id: "crudeoil",
    symbol: "CRUDE OIL",
    name: "MCX Futures",
    price: "₹6,180",
    change: "-0.45%",
    isPositive: false,
    high: "₹6,240",
    low: "₹6,150",
    sparkline: [6220, 6235, 6210, 6195, 6205, 6170, 6180],
  },
];

export function MarketSnapshot() {
  const [markets] = useState<MarketItem[]>(INITIAL_MARKETS);
  const [flickerId, setFlickerId] = useState<string | null>(null);

  // Micro-interaction: Subtle digit heartbeat on random card every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * markets.length);
      const chosen = markets[randomIdx];
      setFlickerId(chosen.id);
      setTimeout(() => setFlickerId(null), 800);
    }, 6000);
    return () => clearInterval(interval);
  }, [markets]);

  return (
    <section id="markets" className="relative py-10 lg:py-14 border-b border-[#1C2734] bg-[#080D14]/60">
      <Container>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#43D9FF] mb-1.5">
              <TrendingUp className="size-3.5" />
              <span>Institutional Overview</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#F5F7FA] tracking-tight">
              Market Snapshot
            </h2>
          </div>
          <div className="text-xs font-mono text-[#667383]">
            Settlement: T+1 Rolling · Exchange Cache Refreshed
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {markets.map((m) => {
            const minVal = Math.min(...m.sparkline);
            const maxVal = Math.max(...m.sparkline);
            const range = maxVal - minVal || 1;
            const points = m.sparkline
              .map((val, idx) => {
                const x = (idx / (m.sparkline.length - 1)) * 100;
                const y = 30 - ((val - minVal) / range) * 24;
                return `${x},${y}`;
              })
              .join(" ");

            const isFlickering = flickerId === m.id;

            return (
              <div
                key={m.id}
                className="group relative rounded-xl border border-[#1C2734] bg-[#0D131C] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-[#283749] hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.7)]"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs font-bold tracking-tight text-[#F5F7FA] font-display">
                    {m.symbol}
                  </span>
                  <span
                    className={`inline-flex items-center text-[11px] font-mono font-semibold ${
                      m.isPositive ? "text-[#22C55E]" : "text-[#F05252]"
                    }`}
                  >
                    {m.isPositive ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {m.change}
                  </span>
                </div>

                <div className="text-[10px] text-[#667383] truncate mt-0.5 font-sans">
                  {m.name}
                </div>

                {/* Price with smooth digit indicator */}
                <div className="mt-3 flex items-baseline justify-between">
                  <div
                    className={`text-lg font-bold font-mono tracking-tight transition-colors duration-300 ${
                      isFlickering
                        ? m.isPositive
                          ? "text-[#22C55E]"
                          : "text-[#F05252]"
                        : "text-[#F5F7FA]"
                    }`}
                  >
                    {m.price}
                  </div>
                </div>

                {/* Mini SVG Sparkline */}
                <div className="mt-3 h-8 w-full overflow-hidden opacity-75 transition-opacity group-hover:opacity-100">
                  <svg viewBox="0 0 100 32" className="size-full overflow-visible" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke={m.isPositive ? "#22C55E" : "#F05252"}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={points}
                    />
                  </svg>
                </div>

                {/* Day Range Mini Bar */}
                <div className="mt-2.5 flex items-center justify-between text-[9px] font-mono text-[#667383] pt-2 border-t border-[#1C2734]/60">
                  <span>L: {m.low}</span>
                  <span>H: {m.high}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
