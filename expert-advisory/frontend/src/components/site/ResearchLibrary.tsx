"use client";

import { useState, useMemo } from "react";
import { Search, Filter, ArrowRight, Calendar, Clock, X, FileText, CheckCircle, ShieldAlert } from "lucide-react";
import { Container, Eyebrow } from "../ui";

interface Report {
  id: string;
  symbol: string;
  title: string;
  category: "Equity" | "Options" | "Indices" | "Commodities" | "Fundamental" | "Technical" | "Risk";
  lens: string;
  date: string;
  updatedDate: string;
  horizon: string;
  invalidation: string;
  target: string;
  summary: string;
  fullThesis: string[];
}

const REPORTS: Report[] = [
  {
    id: "rep-001",
    symbol: "NIFTY 50",
    title: "Monthly Expiry Derivative Structure & Volume Profile Accumulation",
    category: "Indices",
    lens: "Technical & Options",
    date: "30 Sep 2026",
    updatedDate: "01 Oct 2026",
    horizon: "2-5 Trading Sessions",
    invalidation: "25,240",
    target: "25,550 / 25,720",
    summary:
      "Index established a higher-low base at 25,320 with declining implied volatility. Sustained acceptance above VWAP confirms institutional accumulation before monthly expiry.",
    fullThesis: [
      "Open Interest concentration at 25,200 PE provides strong baseline put support.",
      "FII index futures net long positioning increased by 16% over the preceding 3 sessions.",
      "Invalidation criterion: Close below 25,240 invalidates the bullish structural continuation.",
    ],
  },
  {
    id: "rep-002",
    symbol: "BANK NIFTY",
    title: "High Beta Banking Breakout Above 53,800 Resistance Confluence",
    category: "Indices",
    lens: "Technical Analysis",
    date: "29 Sep 2026",
    updatedDate: "30 Sep 2026",
    horizon: "3-7 Trading Sessions",
    invalidation: "53,380",
    target: "54,300 / 54,650",
    summary:
      "Private and PSU banks experiencing synchronized fund inflows. Margin stability and healthy credit disbursement provide support for index breakout.",
    fullThesis: [
      "Credit expansion of 13.8% YoY indicates strong asset cycle resilience.",
      "RSI momentum indicator confirmed bullish divergence on the 4-hour timeframe.",
      "Strict risk invalidation stop positioned below the previous demand pivot at 53,380.",
    ],
  },
  {
    id: "rep-003",
    symbol: "RELIANCE",
    title: "Energy & Telecom Conglomerate Solvency & Channel Breakout",
    category: "Equity",
    lens: "Fundamental & Swing",
    date: "28 Sep 2026",
    updatedDate: "29 Sep 2026",
    horizon: "2-4 Weeks",
    invalidation: "₹2,960",
    target: "₹3,110 / ₹3,180",
    summary:
      "Refining margins stabilizing with Jio ARPU expansion. Consolidation pattern breakout above ₹3,000 indicates reversal of multi-week corrective channel.",
    fullThesis: [
      "Retail revenue growth tracking 16% annualized; net debt-to-equity comfortable at 0.55x.",
      "Volume profile confirms high volume node support defending ₹2,980-₹3,000 band.",
      "Analyst holdings: Nil. Research executed under deterministic indicator rules.",
    ],
  },
  {
    id: "rep-004",
    symbol: "TCS",
    title: "IT Services Valuation Mean-Reversion & Free Cash Flow Yield",
    category: "Fundamental",
    lens: "Fundamental Quality",
    date: "27 Sep 2026",
    updatedDate: "28 Sep 2026",
    horizon: "1-3 Months",
    invalidation: "₹4,120",
    target: "₹4,600",
    summary:
      "Large-cap tech stabilizing after multi-quarter valuation derating. Discretionary spending recovery signals from US BFSI client commentaries.",
    fullThesis: [
      "FCF conversion remains superior at 92% of net income; ROE sustained at 48%.",
      "Deal total contract value (TCV) in BFSI and retail verticals returned to expansion mode.",
      "Downside risk bounded by resilient 3.2% dividend yield and recurring share buyback history.",
    ],
  },
  {
    id: "rep-005",
    symbol: "MCX GOLD",
    title: "Precious Metals Macro Cycle & Central Bank Reserve Accumulation",
    category: "Commodities",
    lens: "Macro & Momentum",
    date: "26 Sep 2026",
    updatedDate: "27 Sep 2026",
    horizon: "2-4 Weeks",
    invalidation: "₹74,100",
    target: "₹76,800",
    summary:
      "Global central bank diversification away from fiat debt coupled with potential rate cuts keeps structural gold trend strongly bid.",
    fullThesis: [
      "De-dollarization tailwinds and sovereign reserve purchases at multi-decade highs.",
      "Breakout from ascending triangle pattern on daily continuous contract.",
      "Invalidation level enforced below swing support of ₹74,100.",
    ],
  },
  {
    id: "rep-006",
    symbol: "NIFTY 25500 CE",
    title: "Options Volatility Skew & Gamma Sensitivity Analysis",
    category: "Options",
    lens: "Derivatives Greeks",
    date: "25 Sep 2026",
    updatedDate: "26 Sep 2026",
    horizon: "Intraday / Positional",
    invalidation: "Premium SL ₹42",
    target: "Target ₹115",
    summary:
      "IV percentile contraction creates favorable risk/reward setup for call debit spreads prior to binary macroeconomic releases.",
    fullThesis: [
      "Implied Volatility (IV) rank at 24th percentile represents attractive vega entry.",
      "Delta risk managed via defined spread architecture to mitigate overnight theta decay.",
      "SEBI Warning: 9 out of 10 individual traders incur net losses in derivatives.",
    ],
  },
];

const CATEGORIES = ["All", "Equity", "Options", "Indices", "Commodities", "Fundamental", "Technical", "Risk"] as const;

export function ResearchLibrary() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const filteredReports = useMemo(() => {
    return REPORTS.filter((rep) => {
      const matchCat =
        selectedCategory === "All" ||
        rep.category.toLowerCase() === selectedCategory.toLowerCase() ||
        rep.lens.toLowerCase().includes(selectedCategory.toLowerCase());

      const query = searchQuery.trim().toLowerCase();
      const matchQuery =
        !query ||
        rep.symbol.toLowerCase().includes(query) ||
        rep.title.toLowerCase().includes(query) ||
        rep.category.toLowerCase().includes(query) ||
        rep.summary.toLowerCase().includes(query);

      return matchCat && matchQuery;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <section id="research" className="relative py-24 lg:py-32 bg-[#080D14] border-b border-[#1C2734]">
      <Container>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <Eyebrow className="mb-3">Published Research</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight">
              Research, organized.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] max-w-2xl leading-relaxed">
              Every research report features published methodology, explicit invalidation stop levels, mathematical risk bounds, and verified timestamps.
            </p>
          </div>
          <div className="text-xs font-mono text-[#667383]">
            Showing {filteredReports.length} research publications
          </div>
        </div>

        {/* Search Bar & Category Filter Pills */}
        <div className="space-y-4 mb-10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[#667383]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="⌕ Search stocks, sectors, indices, derivatives or reports..."
              className="w-full rounded-xl border border-[#1C2734] bg-[#0D131C] py-3.5 pl-11 pr-4 text-sm text-[#F5F7FA] placeholder-[#667383] focus:border-[#43D9FF] focus:outline-none transition-colors font-sans"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-[#667383] mr-2 flex items-center gap-1">
              <Filter className="size-3.5" /> Filters:
            </span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-mono transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#43D9FF] text-[#05070B] font-bold shadow-[0_0_15px_rgba(67,217,255,0.2)]"
                    : "border border-[#1C2734] bg-[#0D131C] text-[#9AA7B5] hover:text-[#F5F7FA] hover:border-[#283749]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Filtered Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="group flex flex-col justify-between rounded-2xl border border-[#1C2734] bg-[#0D131C] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-[#283749] hover:shadow-[0_16px_32px_-10px_rgba(0,0,0,0.8)]"
            >
              <div>
                {/* Meta Badge Bar */}
                <div className="flex items-center justify-between text-[11px] font-mono mb-4 pb-3 border-b border-[#1C2734]">
                  <span className="font-bold text-[#43D9FF] bg-[#43D9FF]/10 px-2 py-0.5 rounded border border-[#43D9FF]/20">
                    {report.symbol}
                  </span>
                  <span className="text-[#667383] flex items-center gap-1">
                    <Calendar className="size-3" /> {report.date}
                  </span>
                </div>

                <div className="text-[10px] font-mono uppercase tracking-wider text-[#7C5CFF] font-semibold">
                  {report.category} · {report.lens}
                </div>

                <h3 className="text-base font-bold font-display text-[#F5F7FA] mt-1.5 line-clamp-2 group-hover:text-[#43D9FF] transition-colors">
                  {report.title}
                </h3>

                <p className="mt-3 text-xs text-[#9AA7B5] leading-relaxed line-clamp-3">
                  {report.summary}
                </p>

                {/* Key Technical Bounds Strip */}
                <div className="mt-5 grid grid-cols-2 gap-2 text-[10px] font-mono bg-[#080D14] p-3 rounded-lg border border-[#1C2734]">
                  <div>
                    <span className="text-[#667383] block">Invalidation (SL):</span>
                    <span className="font-bold text-[#F05252]">{report.invalidation}</span>
                  </div>
                  <div>
                    <span className="text-[#667383] block">Target Objective:</span>
                    <span className="font-bold text-[#22C55E]">{report.target}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-[#1C2734] flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#667383] flex items-center gap-1">
                  <Clock className="size-3" /> {report.horizon}
                </span>
                <button
                  onClick={() => setSelectedReport(report)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#43D9FF] hover:text-white transition-colors cursor-pointer"
                >
                  <span>Read Report</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredReports.length === 0 && (
          <div className="rounded-2xl border border-[#1C2734] bg-[#0D131C] p-12 text-center">
            <FileText className="size-8 text-[#667383] mx-auto mb-3" />
            <h4 className="text-base font-bold text-[#F5F7FA]">No research reports found</h4>
            <p className="text-xs text-[#9AA7B5] mt-1">Try searching for other tickers or resetting filters.</p>
          </div>
        )}

        {/* Report Reader Modal */}
        {selectedReport && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedReport(null)}
          >
            <div
              className="relative w-full max-w-2xl rounded-2xl border border-[#1C2734] bg-[#0D131C] p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedReport(null)}
                className="absolute right-5 top-5 grid size-8 place-items-center rounded-lg border border-[#1C2734] text-[#9AA7B5] hover:text-[#F5F7FA] hover:bg-[#111923]"
                aria-label="Close report reader"
              >
                <X className="size-4" />
              </button>

              <div className="flex items-center gap-2 text-xs font-mono text-[#43D9FF] mb-2">
                <span>{selectedReport.symbol}</span>
                <span>•</span>
                <span>{selectedReport.category} Research</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA] pr-8">
                {selectedReport.title}
              </h3>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#667383] mt-3 pb-4 border-b border-[#1C2734]">
                <span>Published: {selectedReport.date}</span>
                <span>Time Horizon: {selectedReport.horizon}</span>
              </div>

              <div className="mt-6 space-y-4 text-sm text-[#F5F7FA] leading-relaxed">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#9AA7B5] font-mono mb-1.5">
                    Executive Summary
                  </h4>
                  <p className="text-xs sm:text-sm text-[#9AA7B5] leading-relaxed">
                    {selectedReport.summary}
                  </p>
                </div>

                <div className="rounded-xl bg-[#080D14] p-4 border border-[#1C2734] text-xs font-mono grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#667383] block">Invalidation (SL):</span>
                    <span className="font-bold text-[#F05252] text-sm">{selectedReport.invalidation}</span>
                  </div>
                  <div>
                    <span className="text-[#667383] block">Target Objective:</span>
                    <span className="font-bold text-[#22C55E] text-sm">{selectedReport.target}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#9AA7B5] font-mono mb-2">
                    Methodological Pillars
                  </h4>
                  <ul className="space-y-2 text-xs text-[#9AA7B5]">
                    {selectedReport.fullThesis.map((t, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="size-4 text-[#43D9FF] shrink-0 mt-0.5" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg bg-[#111923] p-4 border border-[#1C2734] text-[11px] font-mono text-[#667383] leading-relaxed">
                  <span className="text-[#F5B84B] font-semibold">Statutory Risk Notice: </span>
                  Investments in securities market are subject to market risks. Read all related documents carefully before investing. Research does not guarantee returns.
                </div>
              </div>
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
