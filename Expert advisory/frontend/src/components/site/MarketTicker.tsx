"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface IndexItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
}

const INDICES: IndexItem[] = [
  { symbol: "NIFTY 50", name: "NSE Benchmark", price: "25,418.50", change: "+0.64%", isPositive: true },
  { symbol: "SENSEX", name: "BSE Benchmark", price: "83,184.80", change: "+0.58%", isPositive: true },
  { symbol: "BANK NIFTY", name: "Banking Sector", price: "53,890.15", change: "+0.72%", isPositive: true },
  { symbol: "INDIA VIX", name: "Volatility Index", price: "12.42", change: "-3.25%", isPositive: false },
  { symbol: "NIFTY IT", name: "Technology Sector", price: "42,310.20", change: "-0.18%", isPositive: false },
  { symbol: "NIFTY AUTO", name: "Automobile Sector", price: "26,140.90", change: "+1.12%", isPositive: true },
  { symbol: "GOLD (MCX)", name: "Commodity", price: "₹74,850", change: "+0.34%", isPositive: true },
  { symbol: "CRUDE OIL", name: "MCX Futures", price: "₹5,940", change: "+0.45%", isPositive: true },
];

export function MarketTicker() {
  // Duplicate list to achieve a continuous, jitter-free infinite loop
  const tickerItems = [...INDICES, ...INDICES];

  return (
    <div className="relative border-y border-ink-200/70 bg-white/70 py-2 backdrop-blur-md overflow-hidden">
      <div className="flex items-center">
        {/* Left static badge */}
        <div className="z-10 flex shrink-0 items-center gap-2 border-r border-ink-200 bg-white px-4 py-0.5 text-xs font-semibold text-ink-900 shadow-sm">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="tracking-wide uppercase text-[11px] text-ink-700">Market Pulse</span>
        </div>

        {/* Marquee track */}
        <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)]">
          <div className="flex shrink-0 animate-marquee items-center gap-8 pl-8 hover:[animation-play-state:paused]">
            {tickerItems.map((item, idx) => (
              <div key={`${item.symbol}-${idx}`} className="flex items-center gap-2.5 text-xs font-mono">
                <span className="font-semibold text-ink-900 tracking-tight">{item.symbol}</span>
                <span className="text-ink-700">{item.price}</span>
                <span
                  className={`inline-flex items-center gap-0.5 font-medium ${
                    item.isPositive ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {item.isPositive ? (
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="size-3.5" aria-hidden="true" />
                  )}
                  {item.change}
                </span>
                <span className="text-ink-300">·</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
