import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import { PageHero, Section } from "@/components/site/PageHero";
import { Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Market insights",
  description: "Market overview for Indian indices and sectors from licensed data providers, with source and timestamp on every figure.",
  alternates: { canonical: "/market-insights" },
};

const PANELS = ["NIFTY 50", "NIFTY Bank", "SENSEX", "Sector performance", "Market breadth", "Volatility"];

export default function MarketInsightsPage() {
  return (
    <>
      <PageHero
        eyebrow="Market insights"
        title="Market overview"
        lead="Figures on this page come only from licensed market-data providers and show their source and time. If data is late or missing, we show that instead of a number."
      />
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PANELS.map((panel) => (
            <Card key={panel} className="p-5">
              <p className="text-sm font-semibold text-ink-900">{panel}</p>
              <p className="mt-4 flex items-center gap-2 text-sm text-warning-700">
                <CloudOff className="size-4" aria-hidden="true" /> Market data unavailable
              </p>
              <p className="mt-1 text-xs text-ink-500">No licensed data provider is connected.</p>
            </Card>
          ))}
        </div>
        <div className="mt-10">
          <EmptyState title="Live market data is not connected yet">
            Index, sector and breadth data will appear once a licensed provider is configured. We do not display scraped or estimated prices.
          </EmptyState>
        </div>
      </Section>
    </>
  );
}
