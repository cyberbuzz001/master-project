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
        <Card className="p-8 text-center sm:p-12">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Lock className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-ink-900">Advisory Subscription Required</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
            {message ?? "You need an active advisory service subscription to access real-time research publications and recommendations."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/portal/billing">
              <Button variant="primary">Explore Services & Plans</Button>
            </Link>
          </div>
        </Card>
      ) : reports.length === 0 ? (
        <Card className="p-8 text-center sm:p-12">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
            <LineChart className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-ink-900">No Research Reports Available</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
            New recommendations matching your suitability profile will appear here once published by our certified research team.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              {reports.length} Active {reports.length === 1 ? "Publication" : "Publications"}
            </p>
            <span className="flex items-center gap-1.5 text-xs text-ink-500">
              <span className="inline-block size-2 rounded-full bg-emerald-500" />
              Live Suitability Filtered Feed
            </span>
          </div>

          <div className="grid gap-6">
            {reports.map((report) => (
              <Card key={report.uuid} className="overflow-hidden p-6 transition-all hover:border-ink-300">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-brand-700">{report.report_code}</span>
                      <Badge tone="neutral">{humanize(report.report_type)}</Badge>
                      <Badge tone="brand">{humanize(report.category)}</Badge>
                    </div>
                    <h3 className="mt-1.5 text-lg font-bold text-ink-900">{report.title}</h3>
                    <p className="mt-1 text-sm text-ink-600">{report.summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-400">Published</p>
                    <p className="text-xs font-medium text-ink-700">{formatDate(report.published_at)}</p>
                    {report.author && (
                      <p className="mt-0.5 text-xs text-ink-500">Analyst: {report.author}</p>
                    )}
                  </div>
                </div>

                {report.recommendations.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-ink-100 text-ink-400">
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
                      <tbody className="divide-y divide-ink-50">
                        {report.recommendations.map((rec) => (
                          <tr key={rec.id} className="hover:bg-ink-50/50">
                            <td className="py-2.5 font-bold text-ink-900">
                              {rec.instrument} <span className="font-normal text-ink-400">({rec.exchange})</span>
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                  rec.direction === "BUY"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                {rec.direction}
                              </span>
                            </td>
                            <td className="py-2.5 font-mono text-ink-700">
                              ₹{rec.entry_low.toLocaleString("en-IN")} - ₹{rec.entry_high.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 font-mono font-medium text-rose-600">
                              ₹{rec.stop_loss.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 font-mono font-medium text-emerald-600">
                              {rec.targets.map((t) => `₹${Number(t).toLocaleString("en-IN")}`).join(", ")}
                            </td>
                            <td className="py-2.5 text-ink-600">{rec.time_horizon}</td>
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

                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-xs text-ink-500">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                    <span>SEBI Mandated Disclosures Bound</span>
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
            <div className="max-h-[75vh] space-y-6 overflow-y-auto p-6 text-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 pb-3">
                <span className="font-mono text-xs font-bold text-brand-700">{detail.data.report_code}</span>
                <Badge tone="neutral">{humanize(detail.data.report_type)}</Badge>
                <span className="text-xs text-ink-400">·</span>
                <span className="text-xs text-ink-600">Published: {formatDate(detail.data.published_at)}</span>
                {detail.data.author && <span className="text-xs text-ink-500">by {detail.data.author}</span>}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Executive Summary</h4>
                <p className="mt-1 leading-relaxed text-ink-700">{detail.data.summary}</p>
              </div>

              {detail.data.body && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Detailed Technical & Fundamental Analysis</h4>
                  <div className="mt-2 rounded-lg bg-ink-50 p-4 font-mono text-xs leading-relaxed text-ink-800 whitespace-pre-line">
                    {detail.data.body}
                  </div>
                </div>
              )}

              {/* Regulatory & Disclosures Box */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-950">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="size-4 text-amber-700" aria-hidden="true" />
                  <span>Mandatory Regulatory Disclosures</span>
                </div>
                <p className="mt-2 leading-relaxed text-amber-900">
                  {detail.data.disclosures?.statutory_disclaimer}
                </p>
                <div className="mt-3 grid gap-2 border-t border-amber-200/60 pt-2 sm:grid-cols-2">
                  <div>
                    <span className="font-semibold">Entity:</span> {detail.data.disclosures?.entity?.legal_name ?? "Expert Stocks Consultancy"}
                  </div>
                  <div>
                    <span className="font-semibold">SEBI Reg #:</span> {detail.data.disclosures?.entity?.registration_number ?? "INH000012345"}
                  </div>
                  <div>
                    <span className="font-semibold">Material Conflict:</span> {detail.data.disclosures?.analyst_declarations?.material_conflict_of_interest ? "Declared" : "Nil"}
                  </div>
                  <div>
                    <span className="font-semibold">Financial Interest:</span> {detail.data.disclosures?.analyst_declarations?.financial_interest ? "Declared" : "Nil"}
                  </div>
                </div>
                {detail.data.content_hash && (
                  <p className="mt-3 font-mono text-[10px] text-amber-700 break-all">
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
