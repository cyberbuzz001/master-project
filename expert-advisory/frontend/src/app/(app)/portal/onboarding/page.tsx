"use client";

import { CheckCircle2, CircleDashed, FileText, MinusCircle, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageTitle } from "@/components/app/AppShell";
import { formatDate, humanize, useApiGet } from "@/components/app/hooks";
import { ApiErrorView, Spinner } from "@/components/app/widgets";
import { Badge, Button, Card, Field, LinkButton, Select, cx } from "@/components/ui";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/api-types";

type Step = { key: string; label: string; status: string; is_required: boolean; completed_at: string | null };
type AgreementVersion = { id: number; code: string; title: string; version: number; body_markdown: string; effective_from: string | null };
type KycCheck = { type: string; label: string; status: string; remarks: string | null };
type ClientDocument = { uuid: string; title: string; category: string; status: string; rejection_reason: string | null; uploaded_at: string };
type RiskProfile = {
  uuid: string;
  category_label: string;
  description: string | null;
  score: number;
  max_score: number;
  methodology_version: string;
  status: string;
  acknowledged_at: string | null;
  expires_at: string | null;
  taken_at: string;
};

type Onboarding = {
  client: { client_code: string; full_name: string; onboarding_status: string; kyc_status: string; relationship_manager: string | null };
  steps: Step[];
  outstanding_agreements: AgreementVersion[];
  kyc: KycCheck[];
  documents: ClientDocument[];
  document_categories: Record<string, string>;
  risk_profile: RiskProfile | null;
};

const STATUS_TONE: Record<string, "positive" | "warning" | "danger" | "neutral"> = {
  completed: "positive",
  verified: "positive",
  pending: "warning",
  in_review: "warning",
  in_progress: "warning",
  rejected: "danger",
  blocked: "danger",
  skipped: "neutral",
};

function StepIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="size-5 text-positive-600" aria-hidden="true" />;
  if (status === "skipped") return <MinusCircle className="size-5 text-ink-400" aria-hidden="true" />;
  return <CircleDashed className="size-5 text-ink-400" aria-hidden="true" />;
}

export default function OnboardingPage() {
  const onboarding = useApiGet<Onboarding>("/client/onboarding");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (onboarding.loading && !onboarding.data) return <Spinner />;
  if (onboarding.error) return <ApiErrorView error={onboarding.error} />;
  if (!onboarding.data) return null;

  const { client, steps, outstanding_agreements: agreements, kyc, documents, document_categories: categories, risk_profile: risk } = onboarding.data;

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      onboarding.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const uploadDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file to upload.");
      return;
    }
    event.currentTarget.reset();
    await run("upload", () => api.upload("/client/documents", form), "Document uploaded. Our team will verify it.");
  };

  const openDocument = async (uuid: string) => {
    setError(null);
    try {
      const res = await api.get<{ url: string }>(`/client/documents/${uuid}/link`);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The link could not be created.");
    }
  };

  return (
    <>
      <PageTitle
        title="Onboarding"
        description="What is done, and what still needs you."
        badge={<Badge tone={client.onboarding_status === "ACTIVE" ? "positive" : "brand"}>{humanize(client.onboarding_status.toLowerCase())}</Badge>}
      />

      {notice && <p className="mb-4 rounded-xl bg-positive-50 px-4 py-3 text-sm text-positive-700">{notice}</p>}
      {error && <p className="mb-4 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-semibold text-ink-900">Your checklist</p>
            <ul className="mt-4 space-y-3">
              {steps.map((step) => (
                <li key={step.key} className="flex items-start gap-3">
                  <StepIcon status={step.status} />
                  <div>
                    <p className={cx("text-sm", step.status === "completed" ? "text-ink-600" : "font-medium text-ink-900")}>
                      {step.label}
                      {!step.is_required && <span className="ml-2 text-xs uppercase tracking-wide text-ink-400">optional</span>}
                    </p>
                    {step.completed_at && <p className="text-xs text-ink-500">{formatDate(step.completed_at)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {agreements.length > 0 && (
            <Card className="p-6">
              <p className="text-sm font-semibold text-ink-900">Agreements to accept</p>
              {agreements.map((agreement) => (
                <div key={agreement.id} className="mt-4 rounded-xl border border-ink-100 p-4">
                  <p className="text-sm font-semibold text-ink-900">
                    {agreement.title} <span className="text-xs font-normal text-ink-500">version {agreement.version}</span>
                  </p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-xs leading-5 text-ink-700">{agreement.body_markdown}</pre>
                  <Button
                    className="mt-3"
                    disabled={busy === `agreement-${agreement.id}`}
                    onClick={() => run(`agreement-${agreement.id}`, () => api.post(`/client/agreements/${agreement.id}/accept`, { accept: true }), "Agreement accepted.")}
                  >
                    I have read and accept this agreement
                  </Button>
                </div>
              ))}
            </Card>
          )}

          <Card className="p-6">
            <p className="text-sm font-semibold text-ink-900">Documents</p>
            <p className="mt-1 text-sm text-ink-600">Files are stored encrypted. Only our verification team can open them, and every access is logged.</p>

            <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={uploadDocument}>
              <div className="min-w-40">
              <Field label="Type" htmlFor="document-category">
                <Select id="document-category" name="category" defaultValue="pan">
                  {Object.entries(categories).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              </div>
              <div className="min-w-56">
              <Field label="File" htmlFor="document-file">
                <input id="document-file" type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm file:font-medium" />
              </Field>
              </div>
              <Button type="submit" disabled={busy === "upload"}>
                <Upload className="mr-2 size-4" aria-hidden="true" /> Upload
              </Button>
            </form>

            <ul className="mt-5 divide-y divide-ink-100">
              {documents.length === 0 && <li className="py-3 text-sm text-ink-500">Nothing uploaded yet.</li>}
              {documents.map((document) => (
                <li key={document.uuid} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="size-4 text-ink-400" aria-hidden="true" />
                    <div>
                      <p className="text-sm text-ink-900">{document.title}</p>
                      <p className="text-xs text-ink-500">Uploaded {formatDate(document.uploaded_at)}</p>
                      {document.rejection_reason && <p className="text-xs text-danger-600">{document.rejection_reason}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={STATUS_TONE[document.status] ?? "neutral"}>{humanize(document.status)}</Badge>
                    <Button variant="ghost" onClick={() => openDocument(document.uuid)}>
                      Open
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-semibold text-ink-900">Risk profile</p>
            {risk === null ? (
              <>
                <p className="mt-2 text-sm text-ink-600">
                  The questionnaire helps us understand your experience, time horizon and comfort with losses. It takes a couple of minutes.
                </p>
                <LinkButton className="mt-4" href="/portal/risk-profile">
                  Start the questionnaire
                </LinkButton>
              </>
            ) : (
              <>
                <p className="mt-3 text-2xl font-semibold text-ink-950">{risk.category_label}</p>
                {risk.description && <p className="mt-1 text-sm text-ink-600">{risk.description}</p>}
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Score</dt>
                    <dd className="text-ink-900">
                      {risk.score} / {risk.max_score}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Method</dt>
                    <dd className="text-ink-900">{risk.methodology_version}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Completed</dt>
                    <dd className="text-ink-900">{formatDate(risk.taken_at)}</dd>
                  </div>
                  {risk.expires_at && (
                    <div className="flex justify-between">
                      <dt className="text-ink-500">Review by</dt>
                      <dd className="text-ink-900">{formatDate(risk.expires_at)}</dd>
                    </div>
                  )}
                </dl>
                {risk.acknowledged_at === null ? (
                  <Button
                    className="mt-4"
                    disabled={busy === "acknowledge"}
                    onClick={() => run("acknowledge", () => api.post(`/client/risk-profile/${risk.uuid}/acknowledge`), "Thank you — your confirmation is recorded.")}
                  >
                    This reflects my circumstances
                  </Button>
                ) : (
                  <p className="mt-4 text-sm text-positive-700">You confirmed this on {formatDate(risk.acknowledged_at)}.</p>
                )}
                <LinkButton variant="ghost" className="mt-2" href="/portal/risk-profile">
                  Retake the questionnaire
                </LinkButton>
              </>
            )}
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold text-ink-900">Identity checks</p>
            <p className="mt-1 text-sm text-ink-600">We record only a masked reference — never your full number.</p>
            <ul className="mt-4 divide-y divide-ink-100">
              {kyc.length === 0 && <li className="py-3 text-sm text-ink-500">Nothing recorded yet. Upload your documents and our team will take it from there.</li>}
              {kyc.map((check) => (
                <li key={check.type} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm text-ink-900">{check.label}</p>
                    {check.remarks && <p className="text-xs text-danger-600">{check.remarks}</p>}
                  </div>
                  <Badge tone={STATUS_TONE[check.status] ?? "neutral"}>{humanize(check.status)}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold text-ink-900">Need help?</p>
            <p className="mt-1 text-sm text-ink-600">
              {client.relationship_manager ? `${client.relationship_manager} is looking after your account.` : "A relationship manager will be assigned shortly."}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
