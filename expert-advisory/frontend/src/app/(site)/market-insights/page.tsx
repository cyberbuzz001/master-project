import type { Metadata } from "next";
import { PageHero, Section } from "@/components/site/PageHero";
import { MarketInsightsView } from "@/components/site/MarketInsightsView";

export const metadata: Metadata = {
  title: "Market Insights",
  description: "Live Indian market overview for indices and sectors powered directly by Fyers API V3, with exchange timestamps on every tick.",
  alternates: { canonical: "/market-insights" },
};

export default function MarketInsightsPage() {
  return (
    <>
      <PageHero
        eyebrow="Market Insights"
        title="Live Market Overview"
        lead="Direct streaming indices and sector movements from licensed data feeds. Every tick is verified against live exchange quotes."
      />
      <Section>
        <MarketInsightsView />
      </Section>
    </>
  );
}
