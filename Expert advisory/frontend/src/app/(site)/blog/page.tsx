import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import { PageHero, Section } from "@/components/site/PageHero";
import { EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Blog",
  description: "Articles on markets, risk and research methodology from Expert Stocks Consultancy.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  return (
    <>
      <PageHero eyebrow="Blog" title="Articles and explainers" lead="Articles are reviewed for accuracy and compliance before publication." />
      <Section>
        <EmptyState icon={<PenLine className="size-5" />} title="No articles published yet" action={<LinkButton href="/resources" variant="secondary">Browse resources</LinkButton>}>
          The first reviewed articles will appear here.
        </EmptyState>
      </Section>
    </>
  );
}
