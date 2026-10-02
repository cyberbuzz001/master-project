import type { Metadata } from "next";
import { RpmForm } from "@/components/site/RpmForm";
import { PageHero, Section } from "@/components/site/PageHero";
import { Card, Notice } from "@/components/ui";
import { getSiteData } from "@/lib/api-server";

export const metadata: Metadata = {
  title: "Risk Assessment & Suitability Evaluation | Expert Stocks Consultancy",
  description: "Understand your investment horizon, market experience, and loss tolerance before subscribing to any advisory service.",
  alternates: { canonical: "/risk-assessment" },
};

const DIMENSIONS = [
  ["Experience & Market History", "How long you have invested or traded, and which segments you have actively navigated."],
  ["Investment Horizon", "Your intended holding period and whether your capital requires near-term liquidity."],
  ["Drawdown & Loss Tolerance", "How you react to adverse market movements and your capacity to endure statistical drawdowns."],
  ["Income & Liquidity Buffer", "Ensuring market exposure is assumed exclusively with non-essential discretionary surplus."],
  ["Instrument Familiarity", "Understanding of equity cash delivery, derivative decay (F&O), and leverage dynamics."],
  ["Capital Preservation Objective", "Matching suitable research strategies to avoid inappropriate risk concentration."],
];

export default async function RiskAssessmentPage() {
  const site = await getSiteData();

  return (
    <>
      <PageHero
        eyebrow="Mandatory Suitability Profiling"
        title="Know your risk profile before you choose an advisory plan"
        lead="A transparent 6-factor questionnaire scored via SEBI-aligned Suitability Methodology 1.0. Calculates your risk capacity tier, suitability recommendations, and risk guidelines."
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1.4fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink-950">What the assessment evaluates</h2>
            <p className="mt-2 text-sm text-ink-600 leading-relaxed">
              In accordance with SEBI (Research Analysts) Regulations, 2014, research advice can only be extended to investors whose risk profiling aligns with the proposed asset class.
            </p>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {DIMENSIONS.map(([title, body]) => (
                <div key={title} className="rounded-2xl bg-ink-50 p-5 ring-1 ring-ink-100">
                  <dt className="text-sm font-semibold text-ink-900">{title}</dt>
                  <dd className="mt-1.5 text-xs leading-5 text-ink-600">{body}</dd>
                </div>
              ))}
            </dl>

            <Notice tone="brand" className="mt-8" title="Deterministic & Audited Scoring">
              Your suitability tier is computed by a transparent, versioned algorithm (Suitability 1.0) &mdash; never arbitrary estimates. A permanent copy is recorded for your compliance audit trail.
            </Notice>

            <div className="mt-6 rounded-2xl bg-ink-50/70 p-5 ring-1 ring-ink-100 text-xs text-ink-600 space-y-2">
              <h4 className="font-semibold text-ink-900">Statutory Risk Tiers:</h4>
              <p>&bull; <strong>Conservative (0–14):</strong> Capital preservation &bull; Cash delivery only.</p>
              <p>&bull; <strong>Moderate (15–26):</strong> Steady growth &bull; Cash swing & momentum.</p>
              <p>&bull; <strong>Balanced (27–38):</strong> Multi-asset &bull; Positional equities & index hedging.</p>
              <p>&bull; <strong>Aggressive (39–60):</strong> High volatility tolerance &bull; Active derivatives & commodities.</p>
            </div>
          </div>

          <div className="h-fit">
            <RpmForm consentText={site.ok ? site.data.consent_text?.data_processing : null} />
          </div>
        </div>
      </Section>
    </>
  );
}
