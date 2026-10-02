"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Clock, ExternalLink, HelpCircle, MessageSquare, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageTitle } from "@/components/app/AppShell";
import { humanize, useApiGet } from "@/components/app/hooks";
import { ApiErrorView, Spinner } from "@/components/app/widgets";
import { Badge, Button, Card, cx } from "@/components/ui";

type SupportTicket = {
  id: number;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  last_reply_at: string | null;
  messages_count?: number;
};

type GrievanceResult = {
  tracking_number: string;
  status: string;
  sla_due_at: string;
  message: string;
};

type TrackedGrievance = {
  tracking_number: string;
  category: string;
  subject: string;
  status: string;
  status_label: string;
  sla_due_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  is_escalated_scores: boolean;
};

export default function SupportDeskPage() {
  const [tab, setTab] = useState<"tickets" | "grievance" | "track">("tickets");

  // Support ticket form state
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState("general");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);

  // Grievance form state
  const [grievanceName, setGrievanceName] = useState("");
  const [grievanceEmail, setGrievanceEmail] = useState("");
  const [grievanceMobile, setGrievanceMobile] = useState("");
  const [grievanceCategory, setGrievanceCategory] = useState("advisory");
  const [grievanceSubject, setGrievanceSubject] = useState("");
  const [grievanceDescription, setGrievanceDescription] = useState("");
  const [grievanceSubmitting, setGrievanceSubmitting] = useState(false);
  const [grievanceResult, setGrievanceResult] = useState<GrievanceResult | null>(null);

  // Tracking state
  const [trackNumber, setTrackNumber] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackedItem, setTrackedItem] = useState<TrackedGrievance | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  const tickets = useApiGet<SupportTicket[]>("/client/support/tickets");

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setTicketSubmitting(true);
    setTicketSuccess(null);

    try {
      const res = await fetch("/api/v1/client/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          subject: ticketSubject,
          category: ticketCategory,
          message: ticketMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create ticket");

      setTicketSuccess(`Ticket ${data.data.ticket_number} created successfully.`);
      setTicketSubject("");
      setTicketMessage("");
      tickets.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTicketSubmitting(false);
    }
  }

  async function handleSubmitGrievance(e: React.FormEvent) {
    e.preventDefault();
    setGrievanceSubmitting(true);
    setGrievanceResult(null);

    try {
      const res = await fetch("/api/v1/public/grievances", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          complainant_name: grievanceName,
          email: grievanceEmail,
          mobile: grievanceMobile,
          category: grievanceCategory,
          subject: grievanceSubject,
          description: grievanceDescription,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit grievance");

      setGrievanceResult(data.data);
      setGrievanceSubject("");
      setGrievanceDescription("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGrievanceSubmitting(false);
    }
  }

  async function handleTrackGrievance(e: React.FormEvent) {
    e.preventDefault();
    if (!trackNumber.trim()) return;

    setTrackLoading(true);
    setTrackError(null);
    setTrackedItem(null);

    try {
      const res = await fetch(`/api/v1/public/grievances/${encodeURIComponent(trackNumber.trim())}`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Grievance record not found.");
      setTrackedItem(data.data);
    } catch (err: any) {
      setTrackError(err.message);
    } finally {
      setTrackLoading(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Client Support & Grievance Redressal"
        description="Raise service inquiries or lodge statutory complaints under SEBI Investor Charter guidelines."
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-ink-200 gap-2 mb-6">
        <button
          onClick={() => setTab("tickets")}
          className={cx(
            "pb-3 px-4 text-sm font-semibold border-b-2 transition-colors",
            tab === "tickets"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-ink-500 hover:text-ink-900"
          )}
        >
          Support Tickets
        </button>
        <button
          onClick={() => setTab("grievance")}
          className={cx(
            "pb-3 px-4 text-sm font-semibold border-b-2 transition-colors",
            tab === "grievance"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-ink-500 hover:text-ink-900"
          )}
        >
          Lodge SEBI Grievance
        </button>
        <button
          onClick={() => setTab("track")}
          className={cx(
            "pb-3 px-4 text-sm font-semibold border-b-2 transition-colors",
            tab === "track"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-ink-500 hover:text-ink-900"
          )}
        >
          Track Grievance
        </button>
      </div>

      {/* Tab 1: Support Tickets */}
      {tab === "tickets" && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-ink-900">Your Support Tickets</h3>
            {tickets.loading && !tickets.data ? (
              <Spinner />
            ) : tickets.error ? (
              <ApiErrorView error={tickets.error} />
            ) : !tickets.data || tickets.data.length === 0 ? (
              <Card className="p-8 text-center">
                <HelpCircle className="mx-auto size-8 text-ink-400 mb-2" />
                <p className="text-sm font-medium text-ink-900">No support tickets found</p>
                <p className="text-xs text-ink-500 mt-1">Submit a request using the form on the right.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {tickets.data.map((t) => (
                  <Card key={t.id} className="p-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink-500">{t.ticket_number}</span>
                        <Badge tone={t.status === "open" ? "warning" : t.status === "closed" ? "neutral" : "brand"}>
                          {humanize(t.status)}
                        </Badge>
                        <span className="text-xs text-ink-400 capitalize">{t.category}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-ink-900">{t.subject}</p>
                      {t.last_reply_at && (
                        <p className="mt-1 text-xs text-ink-500 flex items-center gap-1">
                          <Clock className="size-3" /> Updated {new Date(t.last_reply_at).toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <Card className="p-6">
              <h3 className="text-base font-semibold text-ink-900 mb-1">Create Support Request</h3>
              <p className="text-xs text-ink-500 mb-4">Our operations desk responds within 24 business hours.</p>

              {ticketSuccess && (
                <div className="mb-4 rounded-lg bg-positive-50 border border-positive-200 p-3 text-xs text-positive-800 flex items-center gap-2">
                  <CheckCircle className="size-4 shrink-0 text-positive-600" />
                  {ticketSuccess}
                </div>
              )}

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="e.g. Question regarding invoice payment"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">Category</label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  >
                    <option value="billing">Billing & Invoices</option>
                    <option value="kyc">KYC & Verification</option>
                    <option value="onboarding">Risk Profile & Onboarding</option>
                    <option value="technical">Portal Technical Issue</option>
                    <option value="general">General Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    placeholder="Describe your issue with transaction reference or details..."
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  />
                </div>

                <Button type="submit" disabled={ticketSubmitting} className="w-full">
                  {ticketSubmitting ? "Submitting..." : "Send Request"}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: SEBI Grievance Redressal */}
      {tab === "grievance" && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <Card className="p-6 border-l-4 border-l-brand-600">
              <div className="flex gap-3">
                <ShieldCheck className="size-6 text-brand-600 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-ink-900">Dedicated Grievance Redressal Mechanism</h3>
                  <p className="mt-1 text-xs text-ink-600 leading-relaxed">
                    Every complaint submitted through this desk is tracked with an official reference code and directly reviewed and audited by our Compliance and Grievance Officer.
                  </p>
                </div>
              </div>
            </Card>

            {grievanceResult ? (
              <Card className="p-8 text-center border-l-4 border-l-positive-600">
                <ShieldCheck className="mx-auto size-12 text-positive-600 mb-3" />
                <h3 className="text-lg font-bold text-ink-900">Grievance Registered Successfully</h3>
                <p className="mt-1 text-sm text-ink-600">Your complaint tracking reference number is:</p>
                <div className="my-4 inline-block bg-ink-100 px-4 py-2 rounded-lg font-mono font-bold text-base text-ink-900 border border-ink-300">
                  {grievanceResult.tracking_number}
                </div>
                <p className="text-xs text-ink-500">
                  Statutory SLA Due Date: <strong>{new Date(grievanceResult.sla_due_at).toLocaleDateString("en-IN")}</strong>
                </p>
                <p className="mt-4 text-xs text-ink-500">
                  Please save this number for tracking and escalating to SEBI SCORES if unresolved.
                </p>
                <Button className="mt-4" onClick={() => setGrievanceResult(null)}>
                  File Another Grievance
                </Button>
              </Card>
            ) : (
              <Card className="p-6">
                <h3 className="text-base font-semibold text-ink-900 mb-1">Formal Complaint Submission</h3>
                <p className="text-xs text-ink-500 mb-4">Please provide detailed facts and any transaction or recommendation reference.</p>

                <form onSubmit={handleSubmitGrievance} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ink-700 mb-1">Complainant Full Name</label>
                      <input
                        type="text"
                        required
                        value={grievanceName}
                        onChange={(e) => setGrievanceName(e.target.value)}
                        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-700 mb-1">Contact Email</label>
                      <input
                        type="email"
                        required
                        value={grievanceEmail}
                        onChange={(e) => setGrievanceEmail(e.target.value)}
                        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ink-700 mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        value={grievanceMobile}
                        onChange={(e) => setGrievanceMobile(e.target.value)}
                        placeholder="+91..."
                        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-700 mb-1">Complaint Category</label>
                      <select
                        value={grievanceCategory}
                        onChange={(e) => setGrievanceCategory(e.target.value)}
                        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                      >
                        <option value="advisory">Advisory / Research Advice</option>
                        <option value="research">Research Report Disclosures</option>
                        <option value="billing">Invoicing & Payments</option>
                        <option value="service">Customer Relationship / Service</option>
                        <option value="compliance">Regulatory & Compliance</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink-700 mb-1">Subject</label>
                    <input
                      type="text"
                      required
                      value={grievanceSubject}
                      onChange={(e) => setGrievanceSubject(e.target.value)}
                      placeholder="Brief summary of your grievance"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink-700 mb-1">Detailed Facts & Description</label>
                    <textarea
                      required
                      rows={5}
                      value={grievanceDescription}
                      onChange={(e) => setGrievanceDescription(e.target.value)}
                      placeholder="Include dates, reports cited, payment transactions, and exact grievance facts..."
                      className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                    />
                  </div>

                  <Button type="submit" disabled={grievanceSubmitting} className="w-full">
                    {grievanceSubmitting ? "Submitting to Grievance Officer..." : "Submit Formal Grievance"}
                  </Button>
                </form>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-6">
              <h4 className="text-sm font-bold text-ink-900 mb-2">Designated Grievance Officer</h4>
              <p className="text-xs text-ink-600 leading-relaxed">
                In compliance with SEBI circulars, all unresolved complaints can be escalated directly to the designated officer:
              </p>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="text-ink-400">Designation:</dt>
                  <dd className="font-semibold text-ink-800">Head of Compliance & Grievance Redressal</dd>
                </div>
                <div>
                  <dt className="text-ink-400">Email:</dt>
                  <dd className="font-mono text-ink-800">grievance@expertstocks.in</dd>
                </div>
                <div>
                  <dt className="text-ink-400">Address:</dt>
                  <dd className="text-ink-800">Expert Stocks Consultancy Pvt. Ltd., Mumbai, Maharashtra</dd>
                </div>
              </dl>
            </Card>

            <Card className="p-6 bg-ink-50">
              <h4 className="text-sm font-bold text-ink-900 mb-1">Resolution Escalation Stages</h4>
              <ol className="mt-2 text-xs text-ink-600 space-y-2 list-decimal list-inside">
                <li><strong>Stage 1:</strong> Dedicated Helpdesk Support acknowledgment within 24 hours.</li>
                <li><strong>Stage 2:</strong> Direct evaluation & resolution by Grievance Redressal Officer.</li>
                <li><strong>Stage 3:</strong> Final executive review by Head of Compliance Cell.</li>
              </ol>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 3: Track Grievance Status */}
      {tab === "track" && (
        <div className="max-w-xl mx-auto space-y-6">
          <Card className="p-6">
            <h3 className="text-base font-semibold text-ink-900 mb-1">Track Grievance Status</h3>
            <p className="text-xs text-ink-500 mb-4">Enter the tracking reference number (e.g. GRV-2026-00001).</p>

            <form onSubmit={handleTrackGrievance} className="flex gap-2">
              <input
                type="text"
                required
                value={trackNumber}
                onChange={(e) => setTrackNumber(e.target.value)}
                placeholder="GRV-2026-XXXXX"
                className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm font-mono focus:border-brand-600 focus:outline-none"
              />
              <Button type="submit" disabled={trackLoading}>
                {trackLoading ? "Searching..." : "Track"}
              </Button>
            </form>

            {trackError && (
              <div className="mt-4 rounded-lg bg-danger-50 border border-danger-200 p-3 text-xs text-danger-800 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-danger-600" />
                {trackError}
              </div>
            )}
          </Card>

          {trackedItem && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                <div>
                  <span className="font-mono text-xs text-ink-500">Tracking Reference</span>
                  <p className="text-sm font-bold text-ink-900">{trackedItem.tracking_number}</p>
                </div>
                <Badge tone={trackedItem.status === "resolved" ? "positive" : trackedItem.status === "new" ? "warning" : "brand"}>
                  {trackedItem.status_label}
                </Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-ink-400">Subject:</span>
                  <p className="font-semibold text-ink-800 text-sm mt-0.5">{trackedItem.subject}</p>
                </div>
                <div>
                  <span className="text-ink-400">Category:</span>
                  <p className="text-ink-800 capitalize">{trackedItem.category}</p>
                </div>
                <div>
                  <span className="text-ink-400">Statutory SLA Target Date:</span>
                  <p className="text-ink-800 font-semibold">{new Date(trackedItem.sla_due_at).toLocaleDateString("en-IN")}</p>
                </div>
                {trackedItem.resolved_at && (
                  <div>
                    <span className="text-ink-400">Resolution Date:</span>
                    <p className="text-positive-700 font-semibold">{new Date(trackedItem.resolved_at).toLocaleString("en-IN")}</p>
                  </div>
                )}
                {trackedItem.resolution_notes && (
                  <div className="mt-3 p-3 bg-positive-50 border border-positive-200 rounded-lg">
                    <span className="text-positive-900 font-bold block mb-1">Grievance Officer Written Resolution:</span>
                    <p className="text-positive-800 whitespace-pre-wrap">{trackedItem.resolution_notes}</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
