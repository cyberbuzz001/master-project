"use client";

import { CheckCircle2, ChevronRight, FileText, Info, LineChart, Lock, ShieldAlert, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageTitle } from "@/components/app/AppShell";
import { formatDate, humanize, useApiGet } from "@/components/app/hooks";
import { ApiErrorView, Modal, Spinner } from "@/components/app/widgets";
import { Badge, Button, Card } from "@/components/ui";

type Recommendation = {
  id: number;
  instrument: string;
  exchange: string;
  segment: string;
  direction: string;
  entry_low: number;
  entry_high: number;
  stop_loss: number;
  targets: number[];
  time_horizon: string;
  risk_classification: string;
  status: string;
  performance?: {
    entry_ref: number;
    high_after: number;
    low_after: number;
    mfe: number;
    mae: number;
    outcome: string;
  } | null;
};

type ResearchReportItem = {
  uuid: string;
  report_code: string;
  title: string;
  summary: string;
  report_type: string;
  category: string;
  published_at: string;
  valid_until: string | null;
  author: string | null;
  recommendations: Recommendation[];
};

type ResearchFeedResponse = {
  active_subscription: boolean;
  reports: ResearchReportItem[];
  message?: string;
};

type ReportDetailResponse = ResearchReportItem & {
  body: string | null;
  sections: Record<string, unknown> | null;
  approver: string | null;
  content_hash: string | null;
  disclosure_set_hash: string | null;
  disclosures: {
    statutory_disclaimer?: string;
    entity?: {
      legal_name?: string;
      registration_number?: string;
    };
    analyst_declarations?: {
      financial_interest?: boolean;
      beneficial_ownership_1_percent_or_more?: boolean;
      material_conflict_of_interest?: boolean;
      conflict_details?: string | null;
    };
  } | null;
};

export default function PortalResearchPage() {
  const feed = useApiGet<ResearchFeedResponse>("/client/research");
  const [selectedReportUuid, setSelectedReportUuid] = useState<string | null>(null);
  const detail = useApiGet<ReportDetailResponse>(
    selectedReportUuid ? `/client/research/${selectedReportUuid}` : null
  );

  if (feed.loading && !feed.data) return <Spinner />;
  if (feed.error) return <ApiErrorView error={feed.error} />;
  if (!feed.data) return null;

  const { active_subscription, reports, message } = feed.data;

  return (
    <>
      <PageTitle
        title="Research Desk"
        description="Verified research reports, fundamental analysis, and rule-based recommendations suited to your risk profile."
      />

      {!active_subscription ? (
        <Card className="p-8 text-center sm:p-12 bg-[#090E1A] border-[#1E293B]">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
            <Lock className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-white">Advisory Subscription Required</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            {message ?? "You need an active advisory service subscription to access real-time research publications and recommendations."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/portal/billing">
              <Button variant="primary">Explore Services & Plans</Button>
            </Link>
          </div>
        </Card>
      ) : reports.length === 0 ? (
        <Card className="p-8 text-center sm:p-12 bg-[#090E1A] border-[#1E293B]">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#111923] text-cyan-400">
            <LineChart className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-white">No Research Reports Available</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            New recommendations matching your suitability profile will appear here once published by our certified research team.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              {reports.length} Active {reports.length === 1 ? "Publication" : "Publications"}
            </p>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Suitability Filtered Feed
            </span>
          </div>

          <div className="grid gap-6">
            {reports.map((report) => (
              <Card key={report.uuid} className="overflow-hidden p-6 bg-[#090E1A] border-[#1E293B] hover:border-slate-600 transition-all">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E293B] pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-cyan-400">{report.report_code}</span>
                      <Badge tone="neutral">{humanize(report.report_type)}</Badge>
                      <Badge tone="brand">{humanize(report.category)}</Badge>
                    </div>
                    <h3 className="mt-1.5 text-lg font-bold text-white">{report.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">{report.summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Published</p>
                    <p className="text-xs font-medium text-slate-300">{formatDate(report.published_at)}</p>
                    {report.author && (
                      <p className="mt-0.5 text-xs text-cyan-400">Analyst: {report.author}</p>
                    )}
                  </div>
                </div>

                {report.recommendations.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#1E293B] text-slate-400 font-mono">
                          <th className="pb-2 font-medium">Instrument</th>
                          <th className="pb-2 font-medium">Direction</th>
                          <th className="pb-2 font-medium">Entry Range</th>
                          <th className="pb-2 font-medium">Stop Loss</th>
                          <th className="pb-2 font-medium">Target(s)</th>
                          <th className="pb-2 font-medium">Horizon</th>
                          <th className="pb-2 font-medium">Risk</th>
                          <th className="pb-2 font-medium text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]">
                        {report.recommendations.map((rec) => (
                          <tr key={rec.id} className="hover:bg-[#111923]/50">
                            <td className="py-2.5 font-bold text-white">
                              {rec.instrument} <span className="font-normal text-slate-400 font-mono">({rec.exchange})</span>
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono border ${
                                  rec.direction === "BUY"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                }`}
                              >
                                {rec.direction}
                              </span>
                            </td>
                            <td className="py-2.5 font-mono text-slate-200">
                              ₹{rec.entry_low.toLocaleString("en-IN")} - ₹{rec.entry_high.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 font-mono font-bold text-rose-400">
                              ₹{rec.stop_loss.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 font-mono font-bold text-emerald-400">
                              {rec.targets.map((t) => `₹${Number(t).toLocaleString("en-IN")}`).join(", ")}
                            </td>
                            <td className="py-2.5 text-slate-300">{rec.time_horizon}</td>
                            <td className="py-2.5">
                              <Badge tone={rec.risk_classification === "LOW" ? "positive" : rec.risk_classification === "HIGH" ? "danger" : "warning"}>
                                {rec.risk_classification}
                              </Badge>
                            </td>
                            <td className="py-2.5 text-right">
                              <Badge tone={rec.status === "TARGET_HIT" ? "positive" : rec.status === "STOP_LOSS_HIT" ? "danger" : "neutral"}>
                                {humanize(rec.status)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-[#1E293B] pt-3 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" />
                    <span className="text-slate-300">SEBI Mandated Disclosures Bound</span>
                  </div>
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => setSelectedReportUuid(report.uuid)}
                  >
                    View Full Report & Disclosures →
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReportUuid && (
        <Modal
          title={detail.data?.title ?? "Research Report Detail"}
          onClose={() => setSelectedReportUuid(null)}
          wide
        >
          {detail.loading && !detail.data ? (
            <div className="p-8"><Spinner /></div>
          ) : detail.error ? (
            <div className="p-6"><ApiErrorView error={detail.error} /></div>
          ) : detail.data ? (
            <div className="max-h-[75vh] space-y-6 overflow-y-auto p-6 text-sm text-slate-200">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#1E293B] pb-3">
                <span className="font-mono text-xs font-bold text-cyan-400">{detail.data.report_code}</span>
                <Badge tone="neutral">{humanize(detail.data.report_type)}</Badge>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-400">Published: {formatDate(detail.data.published_at)}</span>
                {detail.data.author && <span className="text-xs text-cyan-300">by {detail.data.author}</span>}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Executive Summary</h4>
                <p className="mt-1 leading-relaxed text-slate-200">{detail.data.summary}</p>
              </div>

              {detail.data.body && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Detailed Technical & Fundamental Analysis</h4>
                  <div className="mt-2 rounded-xl bg-[#0E1624] border border-[#1E293B] p-4 font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-line">
                    {detail.data.body}
                  </div>
                </div>
              )}

              {/* Regulatory & Disclosures Box */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <ShieldAlert className="size-4 text-amber-400" aria-hidden="true" />
                  <span>Mandatory Regulatory Disclosures</span>
                </div>
                <p className="mt-2 leading-relaxed text-amber-200/90">
                  {detail.data.disclosures?.statutory_disclaimer}
                </p>
                <div className="mt-3 grid gap-2 border-t border-amber-500/30 pt-2 sm:grid-cols-2 text-slate-300">
                  <div>
                    <span className="font-semibold text-white">Entity:</span> {detail.data.disclosures?.entity?.legal_name ?? "Expert Stocks Consultancy"}
                  </div>
                  <div>
                    <span className="font-semibold text-white">Desk:</span> Research Advisory Services
                  </div>
                  <div>
                    <span className="font-semibold text-white">Material Conflict:</span> {detail.data.disclosures?.analyst_declarations?.material_conflict_of_interest ? "Declared" : "Nil"}
                  </div>
                  <div>
                    <span className="font-semibold text-white">Financial Interest:</span> {detail.data.disclosures?.analyst_declarations?.financial_interest ? "Declared" : "Nil"}
                  </div>
                </div>
                {detail.data.content_hash && (
                  <p className="mt-3 font-mono text-[10px] text-amber-400/80 break-all">
                    Content SHA-256: {detail.data.content_hash}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </>
  );
}
