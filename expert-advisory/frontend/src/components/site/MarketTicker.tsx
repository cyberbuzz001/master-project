"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface IndexItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
}

const DEFAULT_INDICES: IndexItem[] = [
  { symbol: "NIFTY 50", name: "NSE Benchmark", price: "25,418.50", change: "+0.64%", isPositive: true },
  { symbol: "SENSEX", name: "BSE Benchmark", price: "83,184.80", change: "+0.58%", isPositive: true },
  { symbol: "BANK NIFTY", name: "Banking Sector", price: "53,890.15", change: "+0.72%", isPositive: true },
  { symbol: "INDIA VIX", name: "Volatility Index", price: "12.42", change: "-3.25%", isPositive: false },
  { symbol: "NIFTY IT", name: "Technology Sector", price: "42,310.20", change: "+0.88%", isPositive: true },
  { symbol: "NIFTY AUTO", name: "Automobile Sector", price: "26,140.90", change: "+1.16%", isPositive: true },
  { symbol: "GOLD (MCX)", name: "Commodity", price: "₹75,420", change: "+0.35%", isPositive: true },
  { symbol: "CRUDE OIL", name: "MCX Futures", price: "₹6,180", change: "-0.45%", isPositive: false },
];

export function MarketTicker() {
  const [indices, setIndices] = useState<IndexItem[]>(DEFAULT_INDICES);

  useEffect(() => {
    let isMounted = true;

    async function fetchLiveQuotes() {
      try {
        const res = await fetch("/api/v1/public/market-data");
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data) && json.data.length > 0) {
          setIndices(json.data);
        }
      } catch (_) {}
    }

    fetchLiveQuotes();
    const interval = setInterval(fetchLiveQuotes, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Duplicate list to achieve continuous infinite marquee loop
  const tickerItems = [...indices, ...indices];

  return (
    <div
      className="relative z-30 border-y border-[#1C2734] bg-[#080D14]/90 py-2.5 backdrop-blur-md overflow-hidden select-none"
      role="region"
      aria-label="Live Market Pulse Ticker"
    >
      <div className="flex items-center">
        {/* Left static badge */}
        <div className="z-10 flex shrink-0 items-center gap-2 border-r border-[#1C2734] bg-[#0D131C] px-4 py-1 text-xs font-semibold text-[#F5F7FA] shadow-sm">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-[#22C55E]" />
          </span>
          <span className="font-mono tracking-wider uppercase text-[11px] text-[#43D9FF]">
            Market Pulse
          </span>
        </div>

        {/* Marquee track */}
        <div className="flex overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)]">
          <div className="flex shrink-0 animate-marquee items-center gap-8 pl-8 hover:[animation-play-state:paused]">
            {tickerItems.map((item, idx) => (
              <div key={`${item.symbol}-${idx}`} className="flex items-center gap-2.5 text-xs font-mono">
                <span className="font-semibold text-[#F5F7FA] tracking-tight">{item.symbol}</span>
                <span className="text-[#9AA7B5]">{item.price}</span>
                <span
                  className={`inline-flex items-center gap-0.5 font-medium ${
                    item.isPositive ? "text-[#22C55E]" : "text-[#F05252]"
                  }`}
                >
                  {item.isPositive ? (
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="size-3.5" aria-hidden="true" />
                  )}
                  {item.change}
                </span>
                <span className="text-[#1C2734]">│</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
