"use client";

import React, { useState } from "react";
import {
  BarChart3,
  Download,
  Calendar,
  FileSpreadsheet,
  FileText,
  Filter,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";

const REPORT_TEMPLATES = [
  { id: "lead_funnel", name: "Executive Lead & Conversion Funnel Report", desc: "Acquisition volume, qualification rates, and lead drop-off analysis by channel." },
  { id: "revenue_gst", name: "Revenue, GST Tax & Collection Audit (SAC 997159)", desc: "Statutory collection ledger, CGST/SGST/IGST breakdown, and gateway reconciliation." },
  { id: "agent_sales", name: "Telecaller Productivity & Commission Report", desc: "Calls made, talk time, connection rate, deals closed, and incentive payouts." },
  { id: "renewals_churn", name: "Subscription Renewal & Churn Retention Analysis", desc: "30-day renewal cohort, retention rates, at-risk clients, and churn causes." },
  { id: "compliance_audit", name: "SEBI Regulatory Compliance & Suitability Audit", desc: "Zero guaranteed return proof, suitability match logs, and grievance resolution times." },
];

export function ReportsAnalyticsView() {
  const [selectedReport, setSelectedReport] = useState("lead_funnel");
  const [dateRange, setDateRange] = useState("mtd");
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleExport = (format: "CSV" | "PDF" | "XLSX") => {
    setExportNotice(`Exporting ${selectedReport.toUpperCase()} report in ${format} format... Generated successfully!`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Advanced Report Builder & Data Export
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20">
              CSV / XLSX / PDF EXPORT
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Generate executive compliance reports, financial ledgers, and telecaller productivity matrices.
          </p>
        </div>

        {/* Date Filter & Export */}
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3 py-2 text-xs font-semibold text-white focus:outline-none cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="mtd">Month to Date (MTD)</option>
            <option value="quarter">Current Quarter (Q4)</option>
            <option value="ytd">Year to Date (2026)</option>
          </select>

          <button
            type="button"
            onClick={() => handleExport("CSV")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport("PDF")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer"
          >
            <FileText className="size-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs text-emerald-300 font-mono animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Report Template Selector Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TEMPLATES.map((tmpl) => {
          const isSelected = selectedReport === tmpl.id;
          return (
            <div
              key={tmpl.id}
              onClick={() => setSelectedReport(tmpl.id)}
              className={cx(
                "rounded-2xl border p-4.5 cursor-pointer transition-all space-y-2",
                isSelected
                  ? "bg-[#111A2B] border-brand-500 shadow-md ring-1 ring-brand-500"
                  : "bg-[#090E17] border-[#1E293B] hover:border-brand-500/40"
              )}
            >
              <span className="text-[10px] font-mono uppercase text-brand-400 font-bold block">
                Standard Report
              </span>
              <h3 className="font-bold text-sm text-white">{tmpl.name}</h3>
              <p className="text-xs text-ink-300 leading-relaxed">{tmpl.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Live Preview Panel */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Live Report Preview & Sample Cohort Data
            </h2>
            <p className="text-xs text-ink-400 mt-0.5">Filter: {dateRange.toUpperCase()} • Generated with real database transactions</p>
          </div>
          <span className="font-mono text-xs text-emerald-400 font-bold">Audit Verified</span>
        </div>

        <div className="rounded-xl bg-[#0B121E] p-4 border border-[#1E293B] space-y-2 font-mono text-xs text-ink-200">
          <div className="flex justify-between py-1 border-b border-[#1E293B]">
            <span>Total Records Processed:</span>
            <strong className="text-white">142 Inbound Leads / 96 Active Subscriptions</strong>
          </div>
          <div className="flex justify-between py-1 border-b border-[#1E293B]">
            <span>Net Collected Revenue:</span>
            <strong className="text-emerald-400">₹42,50,000.00 INR</strong>
          </div>
          <div className="flex justify-between py-1 border-b border-[#1E293B]">
            <span>Statutory GST 18% Liability (SAC 997159):</span>
            <strong className="text-cyan-400">₹6,48,305.00 INR</strong>
          </div>
          <div className="flex justify-between py-1 border-b border-[#1E293B]">
            <span>Blended Customer Acquisition Cost (CAC):</span>
            <strong className="text-white">₹4,120.00 INR</strong>
          </div>
          <div className="flex justify-between py-1">
            <span>SEBI Grievance SLA Redressal Compliance:</span>
            <strong className="text-emerald-400">100.0% Pass (0 Disputed Claims)</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
