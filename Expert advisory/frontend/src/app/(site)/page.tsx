import {
  ArrowRight,
  BookOpenCheck,
  FileCheck2,
  Gauge,
  LayoutDashboard,
  LineChart,
  ScaleIcon,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { Section } from "@/components/site/PageHero";
import { Badge, Card, Container, Eyebrow, LinkButton, SectionHeading } from "@/components/ui";
import { MarketTicker } from "@/components/site/MarketTicker";
import { HeroTechnicalRadar } from "@/components/site/HeroTechnicalRadar";
import { InteractivePipeline } from "@/components/site/InteractivePipeline";
import { AnimatedStats } from "@/components/site/AnimatedStats";
import { getSiteData } from "@/lib/api-server";
import { SITE } from "@/lib/site";

const PILLARS = [
  {
    icon: LineChart,
    title: "Technical research",
    body: "Price structure, trend, momentum, volatility and volume analysis — with clearly stated levels, time horizons and invalidation conditions.",
  },
  {
    icon: ScaleIcon,
    title: "Fundamental research",
    body: "Revenue, margins, cash flows, balance-sheet strength, valuation and shareholding, read in the context of the sector.",
  },
  {
    icon: Gauge,
    title: "Risk management",
    body: "Scenario ranges, position-sizing context and risk factors are part of every report — not an afterthought.",
  },
];

export default async function HomePage() {
  const site = await getSiteData();
  const verified = site.ok && site.data.regulatory_profile_verified;

  return (
    <>
      {/* Live Market Ticker Ribbon */}
      <MarketTicker />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_65%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-teal-100/60 blur-3xl animate-pulse-ring" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-40 top-60 size-[30rem] rounded-full bg-brand-200/40 blur-3xl" aria-hidden="true" />
        <Container className="relative grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-[1.05fr_1.1fr]">
          <div className="animate-rise">
            <Badge tone="teal" className="mb-5">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Human-reviewed research · Published methodology
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-ink-950 sm:text-6xl text-balance">
              Research-driven market intelligence for Indian markets
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink-600 text-pretty">
              Data-supported, risk-aware research on Indian equities and derivatives — built on licensed exchange feeds, deterministic calculations and SEBI-authorized review.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <LinkButton href="/research" size="lg">
                Explore research <ArrowRight className="size-4" aria-hidden="true" />
              </LinkButton>
              <LinkButton href="/risk-assessment" size="lg" variant="secondary">
                Take the risk assessment
              </LinkButton>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Link href="/contact" className="font-medium text-brand-700 hover:text-brand-900">
                Talk to our team →
              </Link>
              <Link href="/login" className="font-medium text-ink-600 hover:text-ink-950">
                Client login
              </Link>
            </div>
          </div>

          {/* Interactive Technical Research Radar Motion Graphic */}
          <div className="animate-rise [animation-delay:120ms]">
            <HeroTechnicalRadar />
          </div>
        </Container>
      </section>

      {/* Market intelligence pillars */}
      <Section>
        <SectionHeading
          eyebrow="Market intelligence"
          title="Three lenses on every opportunity — and on its risks"
          lead="Our research combines technical structure, business fundamentals and explicit risk analysis, so every view states what would prove it wrong."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} className="p-6 transition-shadow hover:shadow-[var(--shadow-lift)]">
              <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-600">
                <pillar.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ink-950">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">{pillar.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Institutional Compliance & Quality Statistics */}
      <AnimatedStats />

      {/* Research process + quality gate */}
      <Section tone="muted">
        <div className="space-y-10">
          <SectionHeading
            eyebrow="Research process & quality gate"
            title="Every report passes five statutory gates before publication"
            lead="Research is only useful when you can trace its methodology, timestamps, and invalidation levels. Explore how our dual-control pipeline enforces regulatory integrity."
          />

          {/* Interactive Stepper Pipeline */}
          <InteractivePipeline />

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-200/80 bg-white p-6 shadow-sm">
            <div>
              <h4 className="text-base font-bold text-ink-950">Want the complete mathematical methodology?</h4>
              <p className="text-xs text-ink-600">Review our indicator formulas, risk matrix, and SEBI conflict-of-interest declarations.</p>
            </div>
            <LinkButton href="/methodology" variant="secondary">
              Read methodology & disclosures →
            </LinkButton>
          </div>
        </div>
      </Section>

      {/* Technology + client dashboard */}
      <Section>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="overflow-hidden p-8">
            <Eyebrow>Technology</Eyebrow>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-ink-950">Built for traceability</h3>
            <p className="mt-3 text-sm leading-6 text-ink-600">
              Research versions are immutable once published, every approval is logged, and stale or missing data blocks a report instead of
              being filled in.
            </p>
            <LinkButton href="/technology" variant="ghost" className="mt-6 -ml-3">
              How the platform works <ArrowRight className="size-4" aria-hidden="true" />
            </LinkButton>
          </Card>
          <Card className="overflow-hidden p-8">
            <Eyebrow>Client dashboard</Eyebrow>
            <h3 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-ink-950">One place for your service</h3>
            <p className="mt-3 text-sm leading-6 text-ink-600">
              Clients get a secure portal for their risk profile, documents, invoices, research archive and important notices — with the full
              history of every report they received.
            </p>
            <div className="mt-6 flex items-center gap-3 text-sm text-ink-500">
              <LayoutDashboard className="size-4" aria-hidden="true" />
              <span>Portal features are released in stages.</span>
            </div>
          </Card>
        </div>
      </Section>

      {/* Transparency */}
      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <SectionHeading
            eyebrow="Compliance & transparency"
            title="What we publish about ourselves"
            lead="Registration details, the people responsible for research, grievance contacts and our policies are published in the Trust Center once they are verified."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: UserCheck, title: "Human approval", body: "Research is approved by an authorized person who did not write it." },
              { icon: ShieldCheck, title: "No return promises", body: "We never promise profits, accuracy rates or protection from loss." },
              { icon: FileCheck2, title: "Versioned policies", body: "Every policy and disclosure is dated and archived." },
              { icon: BookOpenCheck, title: "Honest performance", body: "Research outcomes are tracked from publication — never backfilled." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-white p-5 ring-1 ring-ink-200/70">
                <item.icon className="size-5 text-brand-600" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-ink-900">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-ink-600">{item.body}</p>
              </div>
            ))}
            <div className="sm:col-span-2">
              <LinkButton href="/trust-center" variant="secondary">
                {verified ? "View verified regulatory details" : "Visit the Trust Center"}
              </LinkButton>
            </div>
          </div>
        </div>
      </Section>

      {/* Education */}
      <Section>
        <SectionHeading
          eyebrow="Educational resources"
          title="Understand the risks before the opportunities"
          lead="Guides on risk management, derivatives, technical analysis and how to read a research report."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Risk-management guide", "Options risk guide", "Reading a research report", "Investor checklist"].map((title) => (
            <Link
              key={title}
              href="/resources"
              className="group rounded-2xl bg-ink-50 p-5 ring-1 ring-ink-100 transition hover:bg-white hover:shadow-[var(--shadow-card)]"
            >
              <BookOpenCheck className="size-5 text-teal-600" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold text-ink-900 group-hover:text-brand-700">{title}</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <section className="bg-white pb-20">
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-ink-950 px-6 py-14 text-center sm:px-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(47_107_239/0.45),transparent_60%)]" aria-hidden="true" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl text-balance">Start with your risk profile</h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-ink-300">
                Understanding your experience, horizon and tolerance for loss comes before any research service.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <LinkButton href="/risk-assessment" size="lg">
                  Take the risk assessment
                </LinkButton>
                <LinkButton href="/contact" size="lg" variant="secondary">
                  Talk to our team
                </LinkButton>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE.name,
            url: SITE.url,
            ...(site.ok && site.data.settings.contact?.email
              ? { contactPoint: [{ "@type": "ContactPoint", email: site.data.settings.contact.email, contactType: "customer support", areaServed: "IN" }] }
              : {}),
          }).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
