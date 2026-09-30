import { FileSearch } from "lucide-react";
import type { Metadata } from "next";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Research",
  description: "Published research from Expert Stocks Consultancy: daily market reports, stock and sector research, and educational reports.",
  alternates: { canonical: "/research" },
};

const REPORT_TYPES = [
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
];

export default function ResearchPage() {
  return (
    <>
      <PageHero
        eyebrow="Research"
        title="Research archive"
        lead="Published research appears here with its publication time, author, approval record, validity period and version. Nothing is shown before it is approved."
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <EmptyState icon={<FileSearch className="size-5" />} title="No public research has been published yet">
            The research workflow — data validation, drafting, compliance review and approval — is being brought online. Approved public and
            educational reports will be listed here.
          </EmptyState>
          <Card className="p-6">
            <p className="text-sm font-semibold text-ink-900">Report types</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {REPORT_TYPES.map((type) => (
                <Badge key={type}>{type}</Badge>
              ))}
            </div>
            <p className="mt-6 text-sm leading-6 text-ink-600">
              Client research is delivered in the secure portal according to each client&apos;s service and risk profile.
            </p>
            <LinkButton href="/methodology" variant="secondary" size="sm" className="mt-5">
              How our research works
            </LinkButton>
          </Card>
        </div>
      </Section>
    </>
  );
}
