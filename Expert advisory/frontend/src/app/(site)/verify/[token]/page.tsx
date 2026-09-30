import { BadgeCheck, ShieldAlert, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card, Notice } from "@/components/ui";
import { verifyDocument } from "@/lib/api-server";

export const metadata: Metadata = {
  title: "Verify a document",
  description: "Check that a report, invoice or receipt was issued by us and still stands.",
  robots: { index: false, follow: false },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
}

export default async function VerifyDocumentPage({ params }: PageProps<"/verify/[token]">) {
  const { token } = await params;
  const result = await verifyDocument(token);

  return (
    <>
      <PageHero
        eyebrow="Verification"
        title="Document check"
        lead="This page confirms whether a document was issued by us. It shows no personal details."
      />
      <Section>
        {!result.ok ? (
          <Notice tone="warning" title="We could not check this document right now">
            Please try again in a few minutes. If the problem continues, contact us and quote the number printed on your copy.
          </Notice>
        ) : !result.data.found ? (
          <Card className="flex gap-4 p-6 sm:p-8">
            <ShieldX className="mt-0.5 size-6 shrink-0 text-danger-600" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-ink-950">No document matches this link</h2>
              <p className="mt-2 text-sm leading-6 text-ink-600">
                The link may have been typed incorrectly, or the document was not issued by us. Please check the QR code on your copy, or
                contact us with the document number.
              </p>
            </div>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
                <BadgeCheck className="size-5 text-positive-600" aria-hidden="true" />
                {result.data.type_label} {result.data.number} is genuine
              </h2>
              <Badge tone={result.data.still_current ? "positive" : "warning"}>{result.data.still_current ? "Current" : "No longer current"}</Badge>
            </div>

            {result.data.is_demo && (
              <p className="mt-4 rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700">
                This is demonstration data, not a real client record.
              </p>
            )}

            <dl className="mt-6 divide-y divide-ink-100">
              <div className="grid gap-1 py-3 sm:grid-cols-[240px_1fr]">
                <dt className="text-sm text-ink-500">Document</dt>
                <dd className="text-sm font-medium text-ink-900">
                  {result.data.type_label} {result.data.number}
                </dd>
              </div>
              <div className="grid gap-1 py-3 sm:grid-cols-[240px_1fr]">
                <dt className="text-sm text-ink-500">Issued on</dt>
                <dd className="text-sm font-medium text-ink-900">{formatDate(result.data.issued_on)}</dd>
              </div>
              {Object.entries(result.data.details).map(([label, value]) => (
                <div key={label} className="grid gap-1 py-3 sm:grid-cols-[240px_1fr]">
                  <dt className="text-sm text-ink-500">{label}</dt>
                  <dd className="text-sm font-medium text-ink-900">{value}</dd>
                </div>
              ))}
              {result.data.pdf_sha256 && (
                <div className="grid gap-1 py-3 sm:grid-cols-[240px_1fr]">
                  <dt className="text-sm text-ink-500">File checksum (SHA-256)</dt>
                  <dd className="break-all font-mono text-xs text-ink-700">{result.data.pdf_sha256}</dd>
                </div>
              )}
            </dl>

            {!result.data.still_current && (
              <div className="mt-6 flex gap-3 rounded-xl bg-warning-50 p-4">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning-700" aria-hidden="true" />
                <p className="text-sm leading-6 text-warning-800">
                  {result.data.type === "risk_report"
                    ? "A newer assessment has since been recorded, so this copy no longer reflects the current profile."
                    : result.data.type === "receipt"
                      ? "This payment was later refunded, so the receipt no longer stands."
                      : "This invoice has been voided."}{" "}
                  Ask your relationship manager for the current document.
                </p>
              </div>
            )}

            <p className="mt-6 text-sm leading-6 text-ink-600">
              Verification confirms the document came from us and whether it still stands. It is not investment advice and does not promise
              any return.
            </p>
          </Card>
        )}
      </Section>
    </>
  );
}
