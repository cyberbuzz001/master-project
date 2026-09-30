import { BookOpen, CandlestickChart, ClipboardCheck, Layers, Newspaper, PieChart } from "lucide-react";
import type { Metadata } from "next";
import { PageHero, Section } from "@/components/site/PageHero";
import { Card, LinkButton, Notice } from "@/components/ui";

export const metadata: Metadata = {
  title: "Services",
  description: "Equity research, derivatives research, market commentary, risk profiling and educational resources for Indian markets.",
  alternates: { canonical: "/services" },
};

const SERVICES = [
  {
    icon: PieChart,
    title: "Equity research",
    body: "Stock and sector research combining business fundamentals with price structure, published with a time horizon, levels and invalidation conditions.",
  },
  {
    icon: CandlestickChart,
    title: "Derivatives research",
    body: "Index and stock derivatives analysis using open interest, volatility and option-chain data, with explicit leverage and loss warnings.",
  },
  {
    icon: Newspaper,
    title: "Daily market reports",
    body: "Pre-market and post-market reports on indices, sectors, breadth and scheduled events, sourced and time-stamped.",
  },
  {
    icon: ClipboardCheck,
    title: "Risk profiling",
    body: "A structured questionnaire and scored assessment that comes before any research service, so research access matches your profile.",
  },
  {
    icon: Layers,
    title: "Research archive",
    body: "Clients can revisit every report they received, with its version history and how it was tracked after publication.",
  },
  {
    icon: BookOpen,
    title: "Education",
    body: "Guides, explainers and webinars on risk management, derivatives and reading research — educational, never promotional.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Research and tools for informed decisions"
        lead="Services are offered only within the scope of our verified regulatory status and only after onboarding and risk profiling."
      >
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/risk-assessment">Start with a risk assessment</LinkButton>
          <LinkButton href="/pricing" variant="secondary">
            How plans work
          </LinkButton>
        </div>
      </PageHero>
      <Section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <Card key={service.title} className="p-6">
              <service.icon className="size-6 text-brand-600" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold text-ink-950">{service.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-600">{service.body}</p>
            </Card>
          ))}
        </div>
        <Notice tone="neutral" className="mt-10" title="Availability">
          Which services are available, and in which market segments, depends on our verified registration scope. Details are listed in the
          Trust Center.
        </Notice>
      </Section>
    </>
  );
}
