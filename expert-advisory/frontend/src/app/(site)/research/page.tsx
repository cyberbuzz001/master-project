import type { Metadata } from "next";
import { PageHero, Section } from "@/components/site/PageHero";
import { ResearchArchiveView } from "@/components/site/ResearchArchiveView";

export const metadata: Metadata = {
  title: "Research Archive",
  description: "Daily published research from Expert Stocks Consultancy: pre-market, post-market, stock and sector research, derivatives analysis, and risk advisories.",
  alternates: { canonical: "/research" },
};

export default function ResearchPage() {
  return (
    <>
      <PageHero
        eyebrow="Research Desk"
        title="Institutional Research Archive"
        lead="Daily market intelligence published across 10 specialized coverage disciplines. Every report features verified exchange metrics, pivot structures, and compliance traceability."
      />
      <Section>
        <ResearchArchiveView />
      </Section>
    </>
  );
}
