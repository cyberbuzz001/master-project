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
  ["Financial Capacity & Surplus", "Source of income, monthly surplus, and emergency reserves ensuring trading is funded only by discretionary capital."],
  ["Trading Objectives & Risk Horizon", "Intended investment timeframe, capital preservation goals, and financial impact if trading capital is lost."],
  ["Drawdown Tolerance & Discipline", "Psychological tolerance for portfolio declines, response to consecutive drawdowns, and stop-loss adherence."],
  ["Instruments & Market Knowledge", "Actual real-capital track record across cash, options, futures, commodities, and understanding of option decay and leverage."],
  ["Decision Integrity & Leverage Controls", "Objective analysis vs tips, strict avoidance of borrowed funds, and adherence to predefined risk budgets."],
  ["Suitability Alignment Guarantee", "Ensuring advisory recommendations strictly respect your risk profile tier and SEBI compliance guidelines."],
];

export default async function RiskAssessmentPage() {
  const site = await getSiteData();

  return (
    <>
      <PageHero
        eyebrow="Mandatory Suitability Profiling (SEBI Aligned)"
        title="Institutional Client Suitability & Risk Profiling"
        lead="A comprehensive 20-factor evaluation across 4 financial dimensions. Accurately calculates your financial capacity, risk tolerance, market knowledge, and suitability tier."
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1.4fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#F5F7FA] font-display">What the assessment evaluates</h2>
            <p className="mt-2 text-sm text-[#9AA7B5] leading-relaxed">
              In accordance with SEBI (Research Analysts) Regulations, 2014, research advice can only be extended to investors whose risk profiling aligns with the proposed asset class and financial capacity.
            </p>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {DIMENSIONS.map(([title, body]) => (
                <div key={title} className="rounded-2xl bg-[#0D131C] p-5 border border-[#1C2734]">
                  <dt className="text-sm font-semibold text-[#F5F7FA]">{title}</dt>
                  <dd className="mt-1.5 text-xs leading-5 text-[#9AA7B5]">{body}</dd>
                </div>
              ))}
            </dl>

            <Notice tone="brand" className="mt-8" title="Multi-Dimensional Scoring Architecture">
              Your suitability tier is computed by evaluating <strong>Financial Capacity</strong>, <strong>Risk Tolerance</strong>, and <strong>Market Knowledge</strong> independently &mdash; never arbitrary estimates. Key safety questions (Q8, Q14, Q15, Q17) ensure leverage protection.
            </Notice>

            <div className="mt-6 rounded-2xl bg-[#080D14] p-5 border border-[#1C2734] text-xs text-[#9AA7B5] space-y-2.5">
              <h4 className="font-semibold text-[#F5F7FA]">Statutory Risk Tiers:</h4>
              <p>&bull; <strong className="text-[#38BDF8]">Conservative (0–39):</strong> Capital preservation &bull; Large-cap cash delivery & liquid ETFs only.</p>
              <p>&bull; <strong className="text-[#10B981]">Moderate (40–59):</strong> Measured compounding &bull; Mid & large cap cash swing trading.</p>
              <p>&bull; <strong className="text-[#F59E0B]">Balanced (60–79):</strong> Controlled volatility &bull; Equities and defined-risk index spreads.</p>
              <p>&bull; <strong className="text-[#A855F7]">Aggressive (80–100):</strong> High volatility capacity &bull; Directional derivatives & momentum setups (requires passing knowledge & leverage safety gates).</p>
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
