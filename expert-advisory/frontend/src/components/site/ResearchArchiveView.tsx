"use client";

import { useState, useMemo } from "react";
import {
  FileText,
  Search,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  PieChart,
  BarChart2,
  X,
  Printer,
  Download,
  CheckCircle,
} from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { ResearchReport, getDailyPublishedReports } from "@/lib/reports";

const CATEGORIES = [
  "All Reports",
  "Pre-market report",
  "Post-market report",
  "Stock research",
  "Sector report",
  "Technical report",
  "Fundamental report",
  "Options market report",
  "Weekly & monthly reports",
  "Educational reports",
  "Risk alerts",
] as const;

export function ResearchArchiveView() {
  const allReports = useMemo(() => getDailyPublishedReports(), []);
  const [selectedCategory, setSelectedCategory] = useState<string>("All Reports");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeReport, setActiveReport] = useState<ResearchReport | null>(null);

  const filteredReports = useMemo(() => {
    return allReports.filter((report) => {
      const matchesCategory =
        selectedCategory === "All Reports" || report.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [allReports, selectedCategory, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header Controls Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-[#1C2734] bg-[#0B111A] p-4">
        <div className="flex items-center gap-2 text-xs font-mono text-[#9AA7B5]">
          <span className="flex items-center gap-1.5 rounded-full bg-[#00E599]/15 px-2.5 py-1 font-bold text-[#00E599]">
            <span className="size-1.5 rounded-full bg-[#00E599] animate-pulse" />
            AUTOMATED DAILY DESK ACTIVE
          </span>
          <span className="hidden sm:inline">· 10 Specialized Coverage Tracks</span>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#667383]" />
          <input
            type="text"
            placeholder="Search reports, tickers, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[#1C2734] bg-[#05070B] py-2 pl-9 pr-4 text-xs text-[#F5F7FA] placeholder-[#667383] focus:border-[#43D9FF] focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#667383] hover:text-[#F5F7FA]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Slider / Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          const count =
            cat === "All Reports"
              ? allReports.length
              : allReports.filter((r) => r.category === cat).length;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
                isSelected
                  ? "bg-[#00E599] text-[#05070B] font-bold shadow-md"
                  : "border border-[#1C2734] bg-[#0D131C] text-[#9AA7B5] hover:border-[#283749] hover:text-[#F5F7FA]"
              }`}
            >
              {cat} <span className="ml-1.5 opacity-75 font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Reports Grid */}
      {filteredReports.length === 0 ? (
        <Card className="p-12 text-center border-[#1C2734] bg-[#0D131C]">
          <FileText className="mx-auto size-8 text-[#667383]" />
          <h3 className="mt-3 text-base font-bold text-[#F5F7FA]">No reports matching your criteria</h3>
          <p className="mt-1 text-xs text-[#9AA7B5]">Try resetting your search query or selecting &quot;All Reports&quot;.</p>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredReports.map((report) => {
            const isAlert = report.category === "Risk alerts";
            return (
              <Card
                key={report.id}
                className={`relative flex flex-col justify-between overflow-hidden border p-6 transition-all hover:-translate-y-1 hover:shadow-xl ${
                  isAlert
                    ? "border-[#F5B84B]/40 bg-[#141008]"
                    : "border-[#1C2734] bg-[#0D131C] hover:border-[#283749]"
                }`}
              >
                <div>
                  {/* Card Header metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${
                        isAlert
                          ? "bg-[#F5B84B]/20 text-[#F5B84B]"
                          : "bg-[#43D9FF]/15 text-[#43D9FF]"
                      }`}
                    >
                      {report.category}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-mono text-[#667383]">
                      <Calendar className="size-3" />
                      {report.publishedAt}
                    </span>
                  </div>

                  {/* Title & Summary */}
                  <h3 className="mt-3 text-lg font-bold text-[#F5F7FA] font-display leading-snug">
                    {report.title}
                  </h3>
                  <p className="mt-2 text-xs text-[#9AA7B5] leading-relaxed line-clamp-3">
                    {report.summary}
                  </p>

                  {/* Metrics preview row */}
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-[#05070B] p-3 text-xs font-mono">
                    {report.metrics.slice(0, 2).map((m, idx) => (
                      <div key={idx}>
                        <span className="text-[10px] text-[#667383] block">{m.label}</span>
                        <span className="font-semibold text-[#F5F7FA] truncate block">{m.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {report.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-[#1C2734] bg-[#080D14] px-2 py-0.5 text-[10px] font-mono text-[#9AA7B5]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer action */}
                <div className="mt-6 flex items-center justify-between border-t border-[#1C2734] pt-4 text-xs font-mono">
                  <span className="text-[11px] text-[#667383] flex items-center gap-1">
                    <Clock className="size-3" /> {report.readTime} · {report.complianceId}
                  </span>
                  <button
                    onClick={() => setActiveReport(report)}
                    className="flex items-center gap-1 font-bold text-[#00E599] transition-transform hover:translate-x-1"
                  >
                    Read Full Report <ChevronRight className="size-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Report Reader Slide-Over / Modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#1C2734] pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#00E599]/15 px-3 py-1 text-xs font-bold font-mono text-[#00E599]">
                    {activeReport.category}
                  </span>
                  <span className="text-xs font-mono text-[#667383]">{activeReport.complianceId}</span>
                </div>
                <h2 className="mt-3 text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
                  {activeReport.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-[#9AA7B5]">
                  <span>Published: {activeReport.publishedAt}</span>
                  <span>Desk: {activeReport.author}</span>
                  <span>Timeframe: {activeReport.timeframe}</span>
                </div>
              </div>
              <button
                onClick={() => setActiveReport(null)}
                className="rounded-lg p-2 text-[#9AA7B5] hover:bg-[#1C2734] hover:text-[#FFFFFF]"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Metrics Dashboard Row */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-[#1C2734] bg-[#05070B] p-4 text-xs font-mono">
              {activeReport.metrics.map((m, idx) => (
                <div key={idx} className="border-r border-[#1C2734] last:border-r-0 pr-2">
                  <span className="text-[10px] text-[#667383] block">{m.label}</span>
                  <span className="mt-0.5 font-bold text-[#F5F7FA] text-sm block">{m.value}</span>
                </div>
              ))}
            </div>

            {/* Technical Levels Table if available */}
            {activeReport.content.technicalLevels && (
              <div className="mt-6 rounded-xl border border-[#1C2734] bg-[#0D131C] p-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#43D9FF] mb-3">
                  Strategic Exchange Levels
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center font-mono text-xs">
                  <div className="rounded bg-[#080D14] p-2 border border-[#1C2734]">
                    <span className="text-[10px] text-[#667383] block">Support 2</span>
                    <span className="font-bold text-[#F05252]">{activeReport.content.technicalLevels.support2}</span>
                  </div>
                  <div className="rounded bg-[#080D14] p-2 border border-[#1C2734]">
                    <span className="text-[10px] text-[#667383] block">Support 1</span>
                    <span className="font-bold text-[#F05252]">{activeReport.content.technicalLevels.support1}</span>
                  </div>
                  <div className="rounded bg-[#080D14] p-2 border border-[#43D9FF]/40">
                    <span className="text-[10px] text-[#43D9FF] block">Pivot Level</span>
                    <span className="font-bold text-[#FFFFFF]">{activeReport.content.technicalLevels.pivot}</span>
                  </div>
                  <div className="rounded bg-[#080D14] p-2 border border-[#1C2734]">
                    <span className="text-[10px] text-[#667383] block">Resistance 1</span>
                    <span className="font-bold text-[#22C55E]">{activeReport.content.technicalLevels.resistance1}</span>
                  </div>
                  <div className="rounded bg-[#080D14] p-2 border border-[#1C2734]">
                    <span className="text-[10px] text-[#667383] block">Resistance 2</span>
                    <span className="font-bold text-[#22C55E]">{activeReport.content.technicalLevels.resistance2}</span>
                  </div>
                  <div className="rounded bg-[#080D14] p-2 border border-[#1C2734]">
                    <span className="text-[10px] text-[#667383] block">Max Pain</span>
                    <span className="font-bold text-[#F5B84B]">{activeReport.content.technicalLevels.maxPain || "N/A"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Executive Summary */}
            <div className="mt-6 space-y-4 text-sm text-[#CBD5E1] leading-relaxed">
              <div>
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#43D9FF] mb-1.5">
                  Executive Summary
                </h4>
                <p className="bg-[#05070B] p-4 rounded-xl border border-[#1C2734]">
                  {activeReport.content.executiveSummary}
                </p>
              </div>

              {/* Key Observations */}
              <div>
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#43D9FF] mb-2">
                  Institutional Observations
                </h4>
                <ul className="space-y-2">
                  {activeReport.content.keyObservations.map((obs, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-[#CBD5E1]">
                      <CheckCircle className="size-4 shrink-0 text-[#00E599] mt-0.5" />
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actionable Takeaway Banner */}
              <div className="rounded-xl border border-[#00E599]/30 bg-[#00E599]/10 p-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#00E599] mb-1">
                  Tactical Actionable Takeaway
                </h4>
                <p className="text-xs text-[#E2E8F0]">{activeReport.content.actionableTakeaway}</p>
              </div>

              {/* Compliance & Risk Disclaimer */}
              <div className="rounded-xl border border-[#1C2734] bg-[#080D14] p-4 text-[11px] text-[#667383]">
                <p className="font-semibold text-[#9AA7B5] mb-1">Compliance & Risk Disclosure:</p>
                <p>{activeReport.content.riskDisclaimer}</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-8 flex items-center justify-between border-t border-[#1C2734] pt-5">
              <span className="text-xs font-mono text-[#667383]">
                Delivered by Expert Stocks Research Desk
              </span>
              <button
                onClick={() => setActiveReport(null)}
                className="rounded-lg bg-[#00E599] px-5 py-2 text-xs font-bold text-[#05070B] hover:opacity-90"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
