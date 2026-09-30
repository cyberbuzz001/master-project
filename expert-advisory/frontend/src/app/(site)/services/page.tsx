import type { Metadata } from "next";
import { 
  BarChart2, 
  BookOpen, 
  CandlestickChart, 
  CheckCircle2, 
  ClipboardCheck, 
  Coins, 
  Flame, 
  Layers, 
  LineChart, 
  Newspaper, 
  PieChart, 
  ShieldCheck, 
  Target, 
  TrendingUp, 
  Zap 
} from "lucide-react";
import Link from "next/link";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card, Container, LinkButton, Notice, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Advisory Services | Expert Stocks Consultancy",
  description: "Comprehensive stock market advisory across Equity Cash, Index Options, Stock Futures, MCX Commodities, and HNI Wealth Strategies.",
  alternates: { canonical: "/services" },
};

const SERVICE_SEGMENTS = [
  {
    icon: LineChart,
    badge: "Cash Market",
    title: "Equity Cash & Delivery Advisory",
    description: "Designed for positional investors and swing traders seeking steady wealth creation in Indian equities.",
    points: [
      "Rigorous technical chart analysis combined with fundamental quarterly earnings health",
      "Large-cap resilience and high-growth mid-cap momentum selections",
      "Explicit entry zones, dual profit targets, and invalidation stop-loss thresholds",
      "Typical holding period: 1 to 6 weeks with ongoing trailing alerts",
    ],
    link: "/pricing",
  },
  {
    icon: Zap,
    badge: "Derivatives",
    title: "Index Options & Futures Intraday",
    description: "Precision-driven momentum setups across NIFTY 50, Bank Nifty, and FinNifty for active derivative participants.",
    points: [
      "Real-time Open Interest (OI) analysis, strike concentration, and PCR tracking",
      "Disciplined Risk-to-Reward ratio of 1:2.5+ on all directional setups",
      "Option Greeks evaluation to optimize strike selection and manage theta decay",
      "Intraday updates during key market reversal and breakout sessions",
    ],
    link: "/pricing",
  },
  {
    icon: CandlestickChart,
    badge: "High Beta F&O",
    title: "Stock Options & Futures Advisory",
    description: "Capturing high-momentum breakout and breakdown moves in high-liquidity F&O underlying stocks.",
    points: [
      "Directional option buying setups and risk-defined spread strategies (Bull/Bear Spreads)",
      "Institutional order flow detection and volume surge confirmation",
      "Weekly and monthly contract rollover recommendations",
      "Strict single-position sizing limits to preserve trading capital",
    ],
    link: "/pricing",
  },
  {
    icon: Flame,
    badge: "Commodities",
    title: "MCX & NCDEX Commodity Research",
    description: "Specialized research reports covering Indian commodity exchanges, bullion, energy, and base metals.",
    points: [
      "Gold & Silver multi-timeframe technical support and resistance levels",
      "Crude Oil and Natural Gas inventory impact and price volatility analysis",
      "Global macro correlation tracking (US Dollar Index, Treasury Yields)",
      "Evening session live market alerts for active commodity traders",
    ],
    link: "/pricing",
  },
  {
    icon: Coins,
    badge: "HNI Bespoke",
    title: "HNI Wealth Generator Strategy",
    description: "Our premier non-discretionary portfolio framework designed for capital pools of ₹25 Lakhs to ₹1 Crore+.",
    points: [
      "Dynamic capital allocation across relative-strength sectors",
      "Systematic market-neutral hedging during heightened market volatility",
      "Quarterly portfolio restructuring and non-performing asset cleanup",
      "Dedicated consultative analyst desk support during market hours",
    ],
    link: "/testimonials",
  },
  {
    icon: BookOpen,
    badge: "Investor Education",
    title: "Technical Mentorship & Education",
    description: "Empowering traders with foundational knowledge to make disciplined, independent market decisions.",
    points: [
      "Multi-module masterclasses on candlestick patterns, chart structures, and volume profiles",
      "Comprehensive derivatives risk education and portfolio sizing rules",
      "Behavioral psychology modules addressing overtrading and revenge trading",
      "Accessible educational resources, investor checklists, and explainers",
    ],
    link: "/resources",
  },
];

const METHODOLOGY_HIGHLIGHTS = [
  {
    title: "Data-Driven Price Action",
    desc: "We look past market rumors. Every recommendation is anchored on multi-timeframe candlestick patterns, support/resistance pivots, and trend structures.",
  },
  {
    title: "Dual Compliance Gate",
    desc: "No research note is dispatched without secondary verification by our authorized Research Analyst desk, ensuring strict regulatory integrity.",
  },
  {
    title: "Explicit Risk Parameters",
    desc: "Every advisory note clearly states what price condition would invalidate the thesis, enforcing disciplined capital preservation.",
  },
  {
    title: "Zero Return Promises",
    desc: "We never make unrealistic profit promises or claim 100% accuracy. We focus on consistent probabilistic execution and sound risk management.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="SEBI-Aligned Market Research"
        title="Comprehensive advisory across all major asset classes"
        lead="Actionable research, disciplined risk management, and transparent levels across Indian Equities, Index Options, Stock Futures, and MCX Commodities."
      >
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/risk-assessment">Take Risk Assessment</LinkButton>
          <LinkButton href="/pricing" variant="secondary">
            View Advisory Plans
          </LinkButton>
        </div>
      </PageHero>

      {/* Services Grid */}
      <Section>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {SERVICE_SEGMENTS.map((service) => {
            const Icon = service.icon;
            return (
              <Card key={service.title} className="flex flex-col justify-between p-6 sm:p-8 transition-all hover:shadow-lg">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                      <Icon className="size-6" />
                    </div>
                    <Badge tone="teal">{service.badge}</Badge>
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-ink-950">{service.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-ink-600">{service.description}</p>

                  <hr className="my-5 border-ink-100" />

                  <ul className="space-y-2.5 text-xs leading-relaxed text-ink-700">
                    {service.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-600" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-ink-100">
                  <Link
                    href={service.link}
                    className="inline-flex items-center text-xs font-semibold text-brand-700 hover:text-brand-900"
                  >
                    Learn more & view plans →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Methodology Highlight */}
      <Section tone="muted">
        <SectionHeading
          eyebrow="Methodology & Discipline"
          title="How our research desk operates"
          lead="We combine quantitative market indicators, volume analysis, and compliance review to deliver institutional-grade research."
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {METHODOLOGY_HIGHLIGHTS.map((item, i) => (
            <Card key={item.title} className="p-6">
              <span className="font-mono text-xs font-bold text-teal-600">0{i + 1}</span>
              <h4 className="mt-2 text-base font-bold text-ink-950">{item.title}</h4>
              <p className="mt-2 text-xs leading-relaxed text-ink-600">{item.desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Suitability Notice */}
      <Section className="py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-ink-950">Mandatory Risk Profiling Notice</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-700">
                In adherence to SEBI regulations, client access to specific segments (especially derivatives and leveraged commodities) is contingent upon completing our suitability assessment. We ensure you only receive research aligned with your risk profile.
              </p>
            </div>
            <LinkButton href="/risk-assessment" className="whitespace-nowrap">
              Start Risk Assessment
            </LinkButton>
          </div>
        </div>
      </Section>
    </>
  );
}
