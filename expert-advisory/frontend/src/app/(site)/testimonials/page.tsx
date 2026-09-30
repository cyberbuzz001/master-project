import type { Metadata } from "next";
import { 
  Award, 
  BarChart2, 
  Briefcase, 
  CheckCircle, 
  Coins, 
  FileCheck2, 
  HelpCircle, 
  Mail, 
  MessageSquareQuote, 
  Phone, 
  ShieldCheck, 
  Star, 
  TrendingUp, 
  Users 
} from "lucide-react";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card, Container, LinkButton, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Testimonials & Portfolio Strategies | Expert Stocks Consultancy",
  description: "Explore verified client reviews and customized wealth generation strategies including HNI Wealth Generator and Non-Discretionary Absolute Momentum.",
  alternates: { canonical: "/testimonials" },
};

const STRATEGIES = [
  {
    icon: Coins,
    tag: "High Capital Allocation",
    title: "HNI Wealth Generator Strategy",
    capitalRange: "INR 25 Lakhs to 1 Crore+",
    description: "Our flagship strategy designed exclusively for high-net-worth investors. Uses systematic multi-asset diversification, dynamic hedging, and alpha-seeking momentum models to grow and preserve large capital pools.",
    features: [
      "Customized asset allocation matrix",
      "Disciplined stop-loss & risk limits",
      "High alpha potential with low drawdown",
      "Direct consultative analyst desk support",
    ],
  },
  {
    icon: TrendingUp,
    tag: "Rule-Based Quantitative",
    title: "Non-Discretionary Absolute Momentum",
    capitalRange: "INR 10 Lakhs to 50 Lakhs",
    description: "An algorithmic, non-discretionary momentum model that eliminates emotional bias. Identifies stocks and index contracts displaying strong relative strength and volume surges for high-probability swing trades.",
    features: [
      "100% data-driven entry and exit signals",
      "Volatility-adjusted position sizing",
      "Pre-defined profit booking milestones",
      "Consistent risk-to-reward ratio of 1:2.5+",
    ],
  },
  {
    icon: BarChart2,
    tag: "Market Outperformance",
    title: "Alpha Extraction Strategy",
    capitalRange: "Active Traders & Investors",
    description: "Engineered to consistently extract alpha across both bullish and volatile sideways markets. Focuses on sector rotation, breakout patterns, and option spread hedges to deliver market-beating returns.",
    features: [
      "Sectoral relative rotation tracking",
      "Option hedging on high-beta equity setups",
      "Continuous market regime adaptation",
      "Real-time alerts via Web & Mobile",
    ],
  },
  {
    icon: Briefcase,
    tag: "Tailored Solutions",
    title: "Customized Wealth Generation Strategy",
    capitalRange: "Personalized Portfolio Planning",
    description: "A tailored wealth-generation advisory framework aligned with your unique financial goals, tax profile, and risk horizon. Crafted by experienced market analysts to optimize your overall portfolio health.",
    features: [
      "Comprehensive portfolio health audit",
      "Rebalancing recommendations",
      "Underperforming asset cleanup",
      "Quarterly performance reviews",
    ],
  },
];

const TESTIMONIALS = [
  {
    name: "Aman Aggrawal",
    role: "HNI Investor & Business Owner",
    rating: 5,
    highlight: "Transformed My Investment Portfolio",
    quote: "The HNI Wealth Generator strategy has truly transformed my investment portfolio. The disciplined risk management and timely entry-exit alerts have made a noticeable difference to my returns. Highly recommend Expert Stocks Consultancy to any serious investor!",
    verified: true,
    productUsed: "HNI Wealth Generator Strategy",
  },
  {
    name: "Rajesh S. Patel",
    role: "Equity & Derivative Trader",
    rating: 5,
    highlight: "Unmatched Accuracy in Option Calls",
    quote: "I have been following their technical analysis on NIFTY and Bank Nifty options. What stands out is their honesty—they state stop losses clearly and never overleverage. It has given me immense consistency.",
    verified: true,
    productUsed: "Non-Discretionary Momentum",
  },
  {
    name: "Pooja Sharma",
    role: "Long-Term Portfolio Investor",
    rating: 5,
    highlight: "Professional & Transparent Advisory",
    quote: "Expert Stocks Consultancy provides transparent research you can actually verify. The team is accessible, courteous, and strictly adheres to SEBI compliance standards. A rare quality in this industry.",
    verified: true,
    productUsed: "Alpha Extraction Strategy",
  },
];

const COMPLIANCE_PILLARS = [
  "Written client consent on record before publishing feedback.",
  "Evidence that the person is or was an active client.",
  "Testimonials describe client service experience and professionalism, not guaranteed returns.",
  "Strict adherence to SEBI Research Analyst code of conduct.",
  "Instant removal upon client request.",
];

export default function TestimonialsPage() {
  return (
    <>
      <PageHero
        eyebrow="Delivering Excellence: Verified Customer Reviews & Strategies"
        title="Testimonials & Portfolio Strategies"
        lead="Discover how our customized HNI wealth generator strategies and quantitative momentum models help investors unlock market alpha with disciplined risk management."
      />

      {/* Featured Client Reviews */}
      <Section>
        <SectionHeading
          eyebrow="What Our Clients Say"
          title="Trusted by Active Traders and HNI Investors"
          lead="Real feedback from verified clients navigating India's capital markets with our research desk."
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="flex flex-col justify-between p-6 sm:p-8 bg-white border border-ink-200/80 shadow-sm transition-all hover:shadow-md">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-500">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="size-4 fill-current" />
                    ))}
                  </div>
                  {t.verified && (
                    <Badge tone="positive" className="text-[11px]">
                      <CheckCircle className="size-3" /> Verified Client
                    </Badge>
                  )}
                </div>

                <h3 className="text-base font-bold text-ink-950">&ldquo;{t.highlight}&rdquo;</h3>
                <p className="text-sm leading-relaxed text-ink-600 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-ink-100">
                <p className="text-sm font-bold text-ink-950">{t.name}</p>
                <p className="text-xs text-ink-500">{t.role}</p>
                <p className="mt-1 text-[11px] font-mono text-teal-600">Product: {t.productUsed}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Customized Product Portfolio Strategies */}
      <Section tone="muted">
        <SectionHeading
          eyebrow="Customized Wealth Solutions"
          title="Invest in Tailored Portfolio Strategies"
          lead="Unlock market alpha with our suite of non-discretionary momentum and HNI wealth generation products designed for varying capital scales."
        />

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {STRATEGIES.map((strat) => {
            const Icon = strat.icon;
            return (
              <Card key={strat.title} className="p-6 sm:p-8 space-y-5 bg-white border border-ink-200/80">
                <div className="flex items-start justify-between">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                    <Icon className="size-6" />
                  </div>
                  <Badge tone="brand">{strat.tag}</Badge>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-ink-950">{strat.title}</h3>
                  <p className="mt-1 font-mono text-xs font-semibold text-teal-700">Capital Scale: {strat.capitalRange}</p>
                </div>

                <p className="text-sm leading-relaxed text-ink-600">{strat.description}</p>

                <div className="space-y-2 pt-2 border-t border-ink-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Key Features</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {strat.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-xs text-ink-700">
                        <CheckCircle className="size-3.5 shrink-0 text-teal-600" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2">
                  <LinkButton href="/contact" variant="secondary" size="sm" className="w-full sm:w-auto">
                    Inquire About This Strategy
                  </LinkButton>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Verified P&L & Transparent Performance Tracking */}
      <Section>
        <div className="rounded-3xl bg-ink-950 p-8 sm:p-12 text-white">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8 space-y-4">
              <Badge tone="teal">Performance Transparency</Badge>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Check Our Verified P&L and Research Audit Trail
              </h2>
              <p className="text-sm leading-relaxed text-ink-300">
                At Expert Stocks Consultancy, we believe in measurable accountability. Every recommendation published by our analysts includes clear entry parameters, target milestones, and mandatory stop losses. We log every setup into a tamper-evident research archive so investors can review our historical accuracy and risk-reward profile.
              </p>
              <div className="pt-2 flex flex-wrap gap-4 text-xs text-ink-400">
                <span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-teal-400" /> SEBI-Aligned Research Records</span>
                <span className="flex items-center gap-1.5"><FileCheck2 className="size-4 text-teal-400" /> Full Audit Trail for Recommendations</span>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-3 lg:items-end">
              <LinkButton href="/research" className="w-full sm:w-auto text-center">
                Explore Research Archive
              </LinkButton>
              <LinkButton href="/contact" variant="secondary" className="w-full sm:w-auto text-center text-ink-950">
                Speak With an Analyst
              </LinkButton>
            </div>
          </div>
        </div>
      </Section>

      {/* Testimonials Compliance Standards */}
      <Section className="py-12 border-t border-ink-100">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-3">
            <SectionHeading
              eyebrow="Compliance & Standards"
              title="Our Feedback Verification Standard"
              lead="How we maintain transparency and regulatory integrity in client testimonials."
            />
          </div>
          <div className="lg:col-span-7">
            <Card className="p-6 sm:p-8 bg-ink-50/50">
              <h3 className="text-base font-bold text-ink-950">A client review is published only when:</h3>
              <ul className="mt-4 space-y-3">
                {COMPLIANCE_PILLARS.map((p, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-ink-700">
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-teal-600" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </Section>

      {/* Statutory Regulatory Notice */}
      <Section className="py-8 bg-ink-50 border-t border-ink-100 text-xs text-ink-500 leading-relaxed">
        <p>
          <strong>Regulatory Notice:</strong> Investment in securities market are subject to market risks. Read all related documents carefully before investing. Registration granted by SEBI, membership of BASL and certification from NISM in no way guarantees performance of the intermediary or provide any assurance of returns to investors. Past performance of any strategy does not guarantee future results.
        </p>
      </Section>
    </>
  );
}
