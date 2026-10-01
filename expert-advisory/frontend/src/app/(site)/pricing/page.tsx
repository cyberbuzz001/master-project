import type { Metadata } from "next";
import { 
  BarChart3, 
  Check, 
  Coins, 
  HelpCircle, 
  LineChart, 
  MessageSquare, 
  PhoneCall, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  Zap 
} from "lucide-react";
import Link from "next/link";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card, Container, LinkButton, Notice, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Advisory Plans & Pricing | Expert Stocks Consultancy",
  description: "Transparent, research-driven advisory plans for Indian equity cash, index options, F&O derivatives, and HNI wealth strategies.",
  alternates: { canonical: "/pricing" },
};

const PLANS = [
  {
    code: "equity-cash",
    name: "Equity Cash Advisory",
    tagline: "For delivery investors and swing traders in cash equities.",
    priceQuarterly: "₹14,999",
    priceAnnual: "₹44,999",
    popular: false,
    badge: "Consistent Momentum",
    icon: LineChart,
    features: [
      "2–4 High-probability equity cash setups per week",
      "Coverage across NSE / BSE Large-cap & Growth Mid-caps",
      "Strict predefined stop-loss and dual-target levels",
      "Technical chart thesis & fundamental rationale included",
      "Weekly portfolio review and sector rotation updates",
      "Suitability & Risk Assessment report included",
    ],
    idealFor: "Traders and investors deploying ₹2 Lakhs to ₹10 Lakhs in cash delivery and swing trades.",
    cta: "Enquire About Equity Plan",
  },
  {
    code: "index-options",
    name: "Index Options & Futures",
    tagline: "High-momentum derivative setups for active intraday traders.",
    priceQuarterly: "₹19,999",
    priceAnnual: "₹59,999",
    popular: true,
    badge: "Most Popular",
    icon: Zap,
    features: [
      "1–2 Focused index options/futures setups daily",
      "Coverage: NIFTY 50, Bank Nifty & FinNifty",
      "Disciplined Risk-to-Reward ratio (1:2.5+ standard)",
      "Real-time alerts with trailing stop-loss adjustments",
      "Open Interest (OI) & Option Greeks analysis",
      "Instant mobile & portal notification dispatch",
    ],
    idealFor: "Active derivative traders operating in benchmark index options with disciplined risk limits.",
    cta: "Get Started with Options",
  },
  {
    code: "multi-segment",
    name: "Stock F&O & Commodities",
    tagline: "Comprehensive coverage across high-beta stock options and MCX commodities.",
    priceQuarterly: "₹29,999",
    priceAnnual: "₹89,999",
    popular: false,
    badge: "Multi-Asset",
    icon: BarChart3,
    features: [
      "High-beta stock options (Bull call/bear put & directional breakouts)",
      "MCX Commodities: Gold, Silver, Crude Oil, Natural Gas",
      "Volume profile and institutional order-flow insights",
      "Weekly expiry rollover strategies and hedge guidelines",
      "Direct consultative analyst desk access during market hours",
      "Priority customer ticket resolution within 2 hours",
    ],
    idealFor: "Experienced traders seeking diversified opportunities across stock derivatives and commodities.",
    cta: "Enquire About Multi-Segment",
  },
  {
    code: "hni-wealth",
    name: "HNI Wealth Generator Strategy",
    tagline: "Bespoke absolute momentum portfolio strategy for high-net-worth investors.",
    priceQuarterly: "Custom",
    priceAnnual: "Bespoke Retainer",
    popular: false,
    badge: "Exclusive HNI",
    icon: Coins,
    features: [
      "Minimum capital deployment: ₹25 Lakhs to ₹1 Crore+",
      "Non-discretionary algorithmic momentum allocation model",
      "Dynamic downside hedging during high market volatility",
      "1-on-1 quarterly review with Lead Research Analyst",
      "Full portfolio health audit and underperformer restructuring",
      "Dedicated Relationship Officer & 24/7 priority support",
    ],
    idealFor: "HNI families, business owners, and corporate treasuries seeking capital appreciation and risk mitigation.",
    cta: "Schedule Private Consultation",
  },
];

const STEPS = [
  {
    num: "1",
    title: "Risk Profiling",
    body: "Complete our mandatory suitability questionnaire to evaluate your trading experience, time horizon, and risk tolerance.",
  },
  {
    num: "2",
    title: "Plan Matching",
    body: "Our advisory desk presents plan options strictly compatible with your designated suitability score and financial capital.",
  },
  {
    num: "3",
    title: "Agreement & KYC",
    body: "Review and electronically execute the SEBI-compliant Client Advisory Agreement and provide identity proof.",
  },
  {
    num: "4",
    title: "Verified Invoice",
    body: "Receive a GST-compliant invoice and complete payment through secure, verified banking channels.",
  },
  {
    num: "5",
    title: "Service Activation",
    body: "Your subscription is activated upon verification, and research delivery begins through the portal and alerts.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Transparent Advisory Plans"
        title="Predictable pricing, institutional research"
        lead="Select an advisory plan aligned with your market segment and trading style. All services require prior risk suitability assessment."
      >
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/risk-assessment">Complete Risk Assessment</LinkButton>
          <LinkButton href="/contact" variant="secondary">
            Speak to an Advisor
          </LinkButton>
        </div>
      </PageHero>

      {/* Plans Grid */}
      <Section>
        <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.code}
                className={`relative flex flex-col justify-between p-6 sm:p-8 transition-all hover:shadow-xl ${
                  plan.popular ? "border-2 border-teal-500 shadow-md ring-1 ring-teal-500/20" : "border border-ink-200/80"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-teal-500 to-brand-600 px-3.5 py-1 text-xs font-bold text-white shadow-sm">
                    {plan.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                      <Icon className="size-6" />
                    </div>
                    {!plan.popular && (
                      <span className="rounded-md bg-ink-100 px-2 py-0.5 font-mono text-xs font-semibold text-ink-700">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-ink-950">{plan.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-ink-600">{plan.tagline}</p>

                  <div className="mt-6 rounded-xl bg-ink-50/70 p-4 border border-ink-100">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-extrabold text-ink-950 sm:text-3xl">
                        {plan.priceQuarterly}
                      </span>
                      <span className="text-xs text-ink-500">/ Quarter</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-600">
                      Annual: <strong className="text-ink-800">{plan.priceAnnual}</strong> (Save ~25%)
                    </p>
                  </div>

                  <p className="mt-4 text-xs font-medium text-ink-500">
                    <strong>Capital Profile:</strong> {plan.idealFor}
                  </p>

                  <hr className="my-6 border-ink-100" />

                  <ul className="space-y-3 text-xs leading-5 text-ink-700">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0 text-teal-600" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4 border-t border-ink-100">
                  <LinkButton
                    href="/contact"
                    variant={plan.popular ? "primary" : "secondary"}
                    className="w-full justify-center text-sm"
                  >
                    {plan.cta}
                  </LinkButton>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Pricing Notice */}
        <div className="mt-10 rounded-2xl bg-brand-50/60 p-6 border border-brand-100/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-brand-950">Statutory GST & Payment Information</h4>
              <p className="mt-1 text-xs text-brand-800 leading-relaxed">
                All listed fees are exclusive of 18% Goods & Services Tax (GST). Payments must be remitted exclusively to the authorized bank account of Expert Stocks Consultancy. We never accept cash or cash deposits into personal accounts.
              </p>
            </div>
            <LinkButton href="/contact" size="sm" variant="ghost" className="whitespace-nowrap">
              Need custom billing? Contact Us →
            </LinkButton>
          </div>
        </div>
      </Section>

      {/* Onboarding Pathway */}
      <Section tone="muted">
        <SectionHeading
          eyebrow="Structured Process"
          title="From initial enquiry to verified service activation"
          lead="We follow a strict 5-stage regulatory onboarding process to ensure complete investor suitability and transparent service delivery."
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-5">
          {STEPS.map((step) => (
            <li key={step.num}>
              <Card className="h-full p-5 flex flex-col justify-between">
                <div>
                  <span className="grid size-8 place-items-center rounded-lg bg-teal-600 font-mono text-xs font-bold text-white">
                    0{step.num}
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-ink-950">{step.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-600">{step.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      {/* FAQ on Pricing */}
      <Section>
        <div className="mx-auto max-w-3xl space-y-6">
          <h2 className="text-2xl font-bold tracking-tight text-[#F5F7FA] font-display">Plans & Billing FAQ</h2>
          
          <div className="divide-y divide-[#1C2734] rounded-2xl border border-[#1C2734] bg-[#0D131C]">
            <div className="p-6">
              <h3 className="text-base font-semibold text-[#F5F7FA]">Can I switch plans mid-way through my subscription?</h3>
              <p className="mt-2 text-sm leading-6 text-[#9AA7B5]">
                Yes. If your risk assessment category permits participation in higher-volatility segments (such as F&O), you can upgrade your plan at any time by paying the prorated difference.
              </p>
            </div>
            <div className="p-6">
              <h3 className="text-base font-semibold text-[#F5F7FA]">Do you offer free trials or guaranteed profit sharing?</h3>
              <p className="mt-2 text-sm leading-6 text-[#9AA7B5]">
                In strict compliance with regulatory standards, we do not provide free trials, profit-sharing models, or performance-contingent fees. All fees are fixed advisory subscriptions charged for verified research and commentary.
              </p>
            </div>
            <div className="p-6">
              <h3 className="text-base font-semibold text-ink-950">What payment methods are supported?</h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">
                We accept payments via NEFT, RTGS, IMPS, UPI, and major credit/debit cards through our verified institutional payment gateway. You receive a digitally signed GST invoice immediately upon payment verification.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Statutory Disclosures Footer */}
      <Section className="py-8 bg-ink-50 border-t border-ink-100 text-xs text-ink-500 leading-relaxed">
        <p>
          <strong>SEBI Mandatory Warning:</strong> Investments in securities market are subject to market risks. Read all related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantees performance of the intermediary or provide any assurance of returns to investors.
        </p>
      </Section>
    </>
  );
}
