import { FileClock } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Markdown } from "@/components/site/Markdown";
import { Container, EmptyState, LinkButton } from "@/components/ui";
import { getPolicy } from "@/lib/api-server";
import { LEGAL_PAGES } from "@/lib/site";

const TITLES: Record<string, string> = {
  "privacy-policy": "Privacy Policy",
  "terms-of-use": "Terms of Use",
  disclaimer: "Disclaimer",
  "refund-policy": "Refund Policy",
  "risk-disclosure": "Risk Disclosure",
  "investor-charter": "Investor Charter",
  "grievance-redressal": "Grievance Redressal",
  "research-methodology": "Research Methodology",
  "cookie-policy": "Cookie Policy",
};

export function generateStaticParams() {
  return LEGAL_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const title = TITLES[slug];
  return title ? { title, alternates: { canonical: `/legal/${slug}` } } : {};
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  if (slug === "disclaimer") redirect("/disclaimer");
  const title = TITLES[slug];

  if (!title) notFound();

  const result = await getPolicy(slug);

  return (
    <Container className="max-w-3xl py-14 sm:py-20">
      {result.ok ? (
        <article>
          <p className="mb-6 text-xs text-ink-500">
            Version {result.data.version}
            {result.data.effective_from && <> · Effective {new Date(result.data.effective_from).toLocaleDateString("en-IN", { dateStyle: "long" })}</>}
          </p>
          <Markdown source={result.data.body_markdown} />
        </article>
      ) : (
        <>
          <h1 className="mb-8 text-3xl font-bold tracking-tight text-ink-950">{title}</h1>
          <EmptyState
            icon={<FileClock className="size-5" />}
            title={result.code === "POLICY_NOT_PUBLISHED" ? "This document is being reviewed" : "This document couldn't be loaded"}
            action={<LinkButton href="/contact" variant="secondary">Contact us</LinkButton>}
          >
            {result.code === "POLICY_NOT_PUBLISHED"
              ? "The current version is under legal and compliance review and will be published here once approved. Contact us if you need a copy of the terms that apply to you."
              : "Please try again shortly."}
          </EmptyState>
        </>
      )}
    </Container>
  );
}
