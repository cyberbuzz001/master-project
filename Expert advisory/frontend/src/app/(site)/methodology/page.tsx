import type { Metadata } from "next";
import { PageHero, Section } from "@/components/site/PageHero";
import { Card, Notice } from "@/components/ui";

export const metadata: Metadata = {
  title: "How our research works",
  description:
    "Data sources, technical and fundamental methodology, AI's role, human review, publication and historical tracking at Expert Stocks Consultancy.",
  alternates: { canonical: "/methodology" },
};

const SECTIONS: Array<{ id: string; title: string; body: string[] }> = [
  {
    id: "data",
    title: "Data sources",
    body: [
      "Market, fundamental, derivatives and news data come from licensed providers. Every data point is stored with its source, the time it refers to and the time we retrieved it.",
      "Before any analysis, data is validated for freshness, missing fields, conflicting sources, extreme values and corporate-action anomalies. If validation fails, no report is produced.",
    ],
  },
  {
    id: "technical",
    title: "Technical methodology",
    body: [
      "Indicators such as moving averages, RSI, MACD, ADX, ATR, Bollinger Bands and VWAP are calculated by tested code with fixed parameters recorded alongside each report.",
      "Levels are derived from price structure and stated with the reasoning behind them, together with the condition that would invalidate the view.",
    ],
  },
  {
    id: "fundamental",
    title: "Fundamental methodology",
    body: [
      "Ratios and growth figures — margins, return on equity and capital, leverage, cash flow and valuation multiples — are computed from reported financial statements, and compared with the company's history and sector.",
    ],
  },
  {
    id: "risk",
    title: "Risk assessment",
    body: [
      "Every report lists its main risk factors and scenarios. Derivatives research states leverage explicitly and warns that losses can exceed margin.",
      "Research is matched to clients according to their finalized risk profile.",
    ],
  },
  {
    id: "ai",
    title: "The role of AI",
    body: [
      "AI tools help summarize data, classify news and draft sections of a report. They receive values computed by our code and are not allowed to introduce prices, levels, news or sources that are not in the verified data.",
      "AI does not calculate core metrics, decide what is published, or send research to clients. Every AI-assisted draft is logged with the model, prompt version and data used.",
    ],
  },
  {
    id: "review",
    title: "Human review and approval",
    body: [
      "Drafts pass automated consistency checks and a compliance review, then must be approved by an authorized person who did not author the draft. Approval is recorded with the approver's name and time.",
    ],
  },
  {
    id: "publication",
    title: "Publication and corrections",
    body: [
      "Published research carries its publication time, validity period, version number, disclosures and approval record. Published versions are never edited — a correction is issued as a new version and the original remains in the archive.",
    ],
  },
  {
    id: "tracking",
    title: "Historical tracking",
    body: [
      "Outcomes are measured using market data after the publication time only, with a documented method. Research outcomes, hypothetical backtests and client account results are different things and are always labelled separately.",
    ],
  },
  {
    id: "conflicts",
    title: "Conflicts of interest",
    body: [
      "Authors declare any financial interest in the instruments they cover before a report can be approved. Applicable disclosures are attached to each report automatically.",
    ],
  },
  {
    id: "limitations",
    title: "Limitations",
    body: [
      "Markets are uncertain. Research can be wrong, data can be delayed or revised, and AI tools can make mistakes, which is why human review is mandatory. No research is a guarantee of returns.",
    ],
  },
];

export default function MethodologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Transparency"
        title="How our research works"
        lead="Code for calculations. Licensed data for facts. AI for interpretation support. Authorized people for approval and publication."
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-label="On this page" className="hidden lg:block">
            <ul className="sticky top-24 space-y-2 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-ink-600 hover:text-brand-700">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-5">
            {SECTIONS.map((section, index) => (
              <Card key={section.id} id={section.id} className="scroll-mt-24 p-6 sm:p-8">
                <p className="font-mono text-xs text-teal-600">{String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-1 text-xl font-semibold text-ink-950">{section.title}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 24)} className="mt-3 text-[15px] leading-7 text-ink-700">
                    {paragraph}
                  </p>
                ))}
              </Card>
            ))}
            <Notice tone="warning" title="No guaranteed returns">
              Investments in the securities market are subject to market risks. Past performance does not indicate future results.
            </Notice>
          </div>
        </div>
      </Section>
    </>
  );
}
