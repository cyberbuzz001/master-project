import { FileClock } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Markdown } from "@/components/site/Markdown";
import { Container, EmptyState, LinkButton } from "@/components/ui";
import { getPolicy } from "@/lib/api-server";
import { LEGAL_PAGES } from "@/lib/site";
import { LEGAL_DOCS, getLegalDocBySlug } from "@/components/legal/legal-data";
import { LegalDocumentHeader } from "@/components/legal/LegalDocumentHeader";
import { LegalNavSidebar } from "@/components/legal/LegalNavSidebar";
import { RelatedDocuments } from "@/components/legal/RelatedDocuments";
import { RiskDisclosureView } from "@/components/legal/RiskDisclosureView";
import { InvestorCharterView } from "@/components/legal/InvestorCharterView";
import { GrievanceRedressalView } from "@/components/legal/GrievanceRedressalView";
import { PrivacyPolicyView } from "@/components/legal/PrivacyPolicyView";
import { TermsOfUseView } from "@/components/legal/TermsOfUseView";
import { RefundPolicyView } from "@/components/legal/RefundPolicyView";
import { CookiePolicyView } from "@/components/legal/CookiePolicyView";

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
  const doc = getLegalDocBySlug(slug);
  const title = doc?.title ?? TITLES[slug];
  const description = doc?.lead ?? "Legal policy and statutory compliance documentation of Expert Stocks Consultancy.";

  return title
    ? {
        title,
        description,
        alternates: { canonical: `/legal/${slug}` },
      }
    : {};
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  if (slug === "disclaimer") redirect("/disclaimer");

  const doc = getLegalDocBySlug(slug);
  const fallbackTitle = TITLES[slug];
  if (!doc && !fallbackTitle) notFound();

  const result = await getPolicy(slug);

  // Render specialized high-fidelity view if available
  const renderSpecializedContent = () => {
    switch (slug) {
      case "risk-disclosure":
        return <RiskDisclosureView />;
      case "investor-charter":
        return <InvestorCharterView />;
      case "grievance-redressal":
        return <GrievanceRedressalView />;
      case "privacy-policy":
        return <PrivacyPolicyView />;
      case "terms-of-use":
        return <TermsOfUseView />;
      case "refund-policy":
        return <RefundPolicyView />;
      case "cookie-policy":
        return <CookiePolicyView />;
      default:
        return result.ok ? (
          <div className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
            <Markdown source={result.data.body_markdown} />
          </div>
        ) : null;
    }
  };

  const activeDoc = doc ?? {
    slug,
    title: fallbackTitle,
    category: "Policies" as const,
    categoryBadge: "Legal Document",
    lead: "Official documentation and compliance disclosures of Expert Stocks Consultancy.",
    version: 1,
    effectiveDate: "01 January 2026",
    lastUpdated: "01 January 2026",
    iconName: "file-text",
    keywords: [],
  };

  return (
    <div className="bg-[#05070B] min-h-screen py-8 sm:py-12">
      <Container className="max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          {/* Left Sticky Sidebar (Desktop) / Dropdown (Mobile) */}
          <LegalNavSidebar currentSlug={slug} />

          {/* Right Main Document Area (Max width ~880px) */}
          <main className="w-full flex-1 max-w-[880px] space-y-8">
            <LegalDocumentHeader doc={activeDoc} />

            {result.ok ? (
              <article className="space-y-6">
                {renderSpecializedContent()}
              </article>
            ) : (
              <div className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
                <EmptyState
                  icon={<FileClock className="size-5" />}
                  title={result.code === "POLICY_NOT_PUBLISHED" ? "This document is being reviewed" : "This document couldn't be loaded"}
                  action={<LinkButton href="/contact" variant="secondary">Contact us</LinkButton>}
                >
                  {result.code === "POLICY_NOT_PUBLISHED"
                    ? "The current version is under legal and compliance review and will be published here once approved. Contact us if you need a copy of the terms that apply to you."
                    : "Please try again shortly."}
                </EmptyState>
              </div>
            )}

            {/* Contextual Related Documents */}
            <RelatedDocuments currentSlug={slug} />
          </main>
        </div>
      </Container>
    </div>
  );
}
