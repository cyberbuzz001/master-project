import type { Metadata } from "next";
import { LeadForm } from "@/components/site/LeadForm";
import { PageHero, Section } from "@/components/site/PageHero";
import { Card, Notice } from "@/components/ui";
import { getSiteData } from "@/lib/api-server";

export const metadata: Metadata = {
  title: "Risk assessment",
  description: "Understand your investment horizon, experience and tolerance for loss before choosing any research service.",
  alternates: { canonical: "/risk-assessment" },
};

const DIMENSIONS = [
  ["Experience", "How long you have invested or traded, and in which products."],
  ["Investment horizon", "How long you intend to stay invested and when you may need the money."],
  ["Loss tolerance", "How much decline you can absorb financially and how you have reacted to losses before."],
  ["Liquidity needs", "Emergency funds and near-term commitments that the investment should not affect."],
  ["Knowledge", "Your familiarity with concepts such as leverage, volatility and derivatives."],
  ["Objectives", "What you want to achieve and which products you are considering."],
];

export default async function RiskAssessmentPage() {
  const site = await getSiteData();

  return (
    <>
      <PageHero
        eyebrow="Risk assessment"
        title="Know your risk profile before you choose a service"
        lead="A structured questionnaire, scored with a documented method, that produces a risk category, suitability notes and warnings — with a PDF copy for your records."
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink-950">What the assessment covers</h2>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {DIMENSIONS.map(([title, body]) => (
                <div key={title} className="rounded-2xl bg-ink-50 p-5 ring-1 ring-ink-100">
                  <dt className="text-sm font-semibold text-ink-900">{title}</dt>
                  <dd className="mt-1.5 text-sm leading-6 text-ink-600">{body}</dd>
                </div>
              ))}
            </dl>
            <Notice tone="brand" className="mt-8" title="How your result is used">
              Your category is calculated by a fixed, versioned scoring method — not by AI. It can only be changed by an authorized reviewer
              who records the reason, and you will see the result and acknowledge it.
            </Notice>
          </div>
          <Card className="h-fit p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-ink-950">Request your assessment</h2>
            <p className="mt-1.5 text-sm leading-6 text-ink-600">
              The online questionnaire is being prepared. Leave your details and our team will send you the assessment link when it is ready.
            </p>
            <div className="mt-6">
              <LeadForm formKey="risk_assessment" consentText={site.ok ? site.data.consent_text : null} submitLabel="Request assessment" compact />
            </div>
          </Card>
        </div>
      </Section>
    </>
  );
}
