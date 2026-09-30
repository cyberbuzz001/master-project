import { BadgeCheck, FileText, Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card, Notice } from "@/components/ui";
import { getTrustCenter } from "@/lib/api-server";
import type { RegulatoryInfo } from "@/lib/api-types";

export const metadata: Metadata = {
  title: "Trust Center",
  description: "Verified legal entity, registration details, responsible persons, grievance contacts and policies of Expert Stocks Consultancy.",
  alternates: { canonical: "/trust-center" },
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[220px_1fr]">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-sm font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function RegulatoryDetails({ info }: { info: RegulatoryInfo }) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-950">Regulatory details</h2>
        <Badge tone="positive">
          <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified {info.verified_at ? new Date(info.verified_at).toLocaleDateString("en-IN", { dateStyle: "medium" }) : ""}
        </Badge>
      </div>
      {info.public_statement && <p className="mt-4 text-[15px] leading-7 text-ink-700">{info.public_statement}</p>}
      <dl className="mt-4 divide-y divide-ink-100">
        <Row label="Legal entity" value={info.legal_entity_name} />
        <Row label="Operating structure" value={info.entity_type_label} />
        <Row label="Research status" value={info.research_status} />
        <Row label="Registration number" value={info.registration_number} />
        <Row label="Registration date" value={info.registration_date} />
        <Row label="Valid until" value={info.registration_valid_until} />
        <Row label="Research Analyst" value={info.ra_name} />
        <Row label="Research Analyst contact" value={info.ra_contact_email} />
        <Row label="Partner Research Analyst" value={info.partner_ra?.name} />
        <Row label="Partner registration number" value={info.partner_ra?.registration_number} />
        <Row label="Principal officer" value={info.principal_officer} />
        <Row label="Compliance officer" value={info.compliance_officer} />
        <Row label="Grievance officer" value={[info.grievance_officer.name, info.grievance_officer.email, info.grievance_officer.phone].filter(Boolean).join(" · ")} />
        <Row label="Next scheduled review" value={info.review_due_at} />
      </dl>
      <p className="mt-4 text-xs text-ink-500">Profile version {info.version}. Previous versions are retained in our records.</p>
    </Card>
  );
}

export default async function TrustCenterPage() {
  const result = await getTrustCenter();

  return (
    <>
      <PageHero
        eyebrow="Trust Center"
        title="Who we are, verified"
        lead="Everything on this page is shown only after it has been checked against source documents by someone other than the person who entered it."
      />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            {!result.ok && (
              <Notice tone="neutral" title="Details temporarily unavailable">
                We couldn&apos;t load the Trust Center right now. Please try again shortly.
              </Notice>
            )}
            {result.ok && result.data.regulatory && <RegulatoryDetails info={result.data.regulatory} />}
            {result.ok && !result.data.regulatory && (
              <Card className="p-6 sm:p-8">
                <Hourglass className="size-6 text-warning-700" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold text-ink-950">Regulatory details are being verified</h2>
                <p className="mt-2 text-[15px] leading-7 text-ink-700">
                  We publish our legal entity, registration category and number, and the people responsible for research only after they are
                  verified. Until then, please do not rely on any registration claim about us from other sources, and contact us with any
                  questions.
                </p>
              </Card>
            )}
            <Notice tone="warning">
              Registration with a regulator does not guarantee the performance of an intermediary or assure returns to investors.
            </Notice>
          </div>

          <Card className="h-fit p-6">
            <h2 className="text-base font-semibold text-ink-950">Policies & disclosures</h2>
            {result.ok && result.data.policies.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {result.data.policies.map((policy) => (
                  <li key={policy.slug}>
                    <Link href={`/legal/${policy.slug}`} className="flex items-center gap-2 text-sm text-ink-700 hover:text-brand-700">
                      <FileText className="size-4 text-ink-400" aria-hidden="true" /> {policy.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-ink-600">Our policies are under legal review and will be listed here when published.</p>
            )}
            <div className="mt-6 border-t border-ink-100 pt-5 text-sm leading-6 text-ink-600">
              <p className="font-medium text-ink-900">Also see</p>
              <ul className="mt-2 space-y-1.5">
                <li><Link href="/methodology" className="hover:text-brand-700">How our research works</Link></li>
                <li><Link href="/legal/grievance-redressal" className="hover:text-brand-700">Grievance redressal</Link></li>
                <li><Link href="/technology" className="hover:text-brand-700">Data security</Link></li>
              </ul>
            </div>
          </Card>
        </div>
      </Section>
    </>
  );
}
