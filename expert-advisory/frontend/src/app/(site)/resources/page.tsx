import type { Metadata } from "next";
import { LeadForm } from "@/components/site/LeadForm";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card } from "@/components/ui";
import { getSiteData } from "@/lib/api-server";

export const metadata: Metadata = {
  title: "Resources",
  description: "Educational guides on risk management, options, technical analysis and reading research reports.",
  alternates: { canonical: "/resources" },
};

const GUIDES = [
  ["Beginner's guide to Indian markets", "How exchanges, orders, settlement and costs work."],
  ["Risk-management guide", "Position sizing, stop-loss limitations and diversification."],
  ["Options risk guide", "Leverage, time decay, volatility and how option premiums can lose value quickly."],
  ["Technical-analysis guide", "What common indicators measure — and what they cannot tell you."],
  ["Reading a research report", "Thesis, levels, validity, invalidation and disclosures explained."],
  ["Investor checklist", "Questions to ask before acting on any research or tip."],
  ["Trading psychology", "Recognizing overconfidence, loss aversion and revenge trading."],
  ["Market calendar explainer", "Results season, policy meetings and expiry days."],
];

export default async function ResourcesPage() {
  const site = await getSiteData();

  return (
    <>
      <PageHero
        eyebrow="Resources"
        title="Educational guides"
        lead="Practical, plain-language material on risk and research. Educational content only — not investment advice and not an offer of returns."
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <ul className="grid gap-4 sm:grid-cols-2">
            {GUIDES.map(([title, body]) => (
              <li key={title}>
                <Card className="h-full p-5">
                  <Badge tone="warning">In preparation</Badge>
                  <p className="mt-3 text-sm font-semibold text-ink-900">{title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-ink-600">{body}</p>
                </Card>
              </li>
            ))}
          </ul>
          <Card className="h-fit p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-ink-950">Get notified when guides are published</h2>
            <p className="mt-1.5 text-sm leading-6 text-ink-600">Tick the email consent to receive guides as they are released.</p>
            <div className="mt-6">
              <LeadForm formKey="resource_download" consentText={site.ok ? site.data.consent_text : null} submitLabel="Notify me" showMessage={false} compact />
            </div>
          </Card>
        </div>
      </Section>
    </>
  );
}
