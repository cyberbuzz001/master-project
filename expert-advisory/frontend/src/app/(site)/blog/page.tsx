import type { Metadata } from "next";
import { ArrowRight, BookOpen, Calendar, Clock, PenLine, ShieldCheck, Tag } from "lucide-react";
import Link from "next/link";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card, Container, LinkButton, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Market Insights & Analytical Blog | Expert Stocks Consultancy",
  description: "Educational articles and research notes on Indian equity structure, options volatility, risk management, and trading psychology.",
  alternates: { canonical: "/blog" },
};

const ARTICLES = [
  {
    slug: "risk-reward-mathematics",
    title: "The Mathematics of Risk-to-Reward: Why 1:2.5 is the Trader's Golden Ratio",
    date: "September 24, 2026",
    readTime: "6 min read",
    category: "Risk Management",
    lead: "Why win-rate alone never determines trading profitability, and how a disciplined 1:2.5 risk-to-reward ratio allows traders to stay profitable even with a 40% accuracy rate.",
    summary: "Most novice market participants obsess over achieving a 90% win rate. In reality, institutional quantitative desks rely on asymmetric payoffs. When you risk ₹1 to make ₹2.50, out of 10 trades, 4 wins net ₹10.00 while 6 losses cost ₹6.00, yielding a net positive expectation of ₹4.00. This article breaks down position sizing, stop-loss placement, and expectancy calculations.",
  },
  {
    slug: "why-retail-traders-lose-in-options",
    title: "Demystifying Index Options: Understanding SEBI's Study on Derivative Losses",
    date: "September 18, 2026",
    readTime: "8 min read",
    category: "Derivatives",
    lead: "An objective examination of why 9 out of 10 individual traders lose capital in index options trading, and the mechanics of theta time decay and extreme leverage.",
    summary: "SEBI's landmark empirical study revealed that individual traders in equity derivatives incurred significant net financial losses. The primary culprit is not market direction, but the compounding effect of rapid time decay (theta) on out-of-the-money options and emotional over-leveraging. Learn how structured spreads and risk-defined hedging can mitigate these catastrophic drawdowns.",
  },
  {
    slug: "volume-profile-institutional-accumulation",
    title: "Volume Profile vs. Traditional Charts: Spotting Institutional Footprints",
    date: "September 12, 2026",
    readTime: "7 min read",
    category: "Technical Analysis",
    lead: "How Point of Control (POC), Value Area High (VAH), and low-volume nodes reveal institutional accumulation before breakout moves occur.",
    summary: "Standard volume histograms only show volume distributed across time. Volume Profile displays volume traded at specific price levels, highlighting where large institutions committed significant capital. When price accepts above a high-volume node, it confirms institutional agreement, creating high-probability support levels for swing traders.",
  },
  {
    slug: "sebi-registered-vs-telegram-tips",
    title: "The Importance of Regulatory Research: SEBI RA vs Unregulated Social Media Tips",
    date: "September 5, 2026",
    readTime: "5 min read",
    category: "Compliance",
    lead: "How to protect yourself against pump-and-dump schemes, unregistered tip channels, and fraudulent return assurances in financial markets.",
    summary: "The rise of unauthorized social media channels promising 100% guaranteed returns or portfolio doubling schemes poses immense danger to retail wealth. Legitimate research must adhere to SEBI (Research Analysts) Regulations, maintain an audit trail, disclose conflicts of interest, and conduct prior risk suitability evaluations.",
  },
];

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="Market Commentary & Research Notes"
        title="Articles, methodology & market insights"
        lead="In-depth, compliance-reviewed articles written by our research desk to help you navigate Indian equities and derivatives with discipline."
      >
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/resources">Explore Educational Guides</LinkButton>
          <LinkButton href="/risk-assessment" variant="secondary">
            Take Risk Assessment
          </LinkButton>
        </div>
      </PageHero>

      {/* Articles List */}
      <Section>
        <div className="mx-auto max-w-4xl space-y-8">
          {ARTICLES.map((article) => (
            <Card key={article.slug} className="p-6 sm:p-8 transition-all hover:shadow-lg border border-ink-200/80">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
                <div className="flex items-center gap-2">
                  <Badge tone="teal">{article.category}</Badge>
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" /> {article.date}
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" /> {article.readTime}
                </span>
              </div>

              <h2 className="mt-4 text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
                {article.title}
              </h2>

              <p className="mt-3 text-sm font-medium text-ink-700 leading-relaxed">
                {article.lead}
              </p>

              <p className="mt-2 text-xs leading-relaxed text-ink-600">
                {article.summary}
              </p>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-ink-100">
                <span className="text-xs font-semibold text-teal-700 flex items-center gap-1">
                  <ShieldCheck className="size-4" /> Reviewed by Research Desk
                </span>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
                >
                  Discuss this strategy with our team <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Regulatory Disclaimers */}
      <Section className="py-8 bg-ink-50 border-t border-ink-100 text-xs text-ink-500 leading-relaxed">
        <p>
          <strong>Statutory Disclosure:</strong> All blog articles and market commentaries published here are for educational, analytical, and illustrative purposes only. They do not constitute an offer to buy or sell securities. Past performance is no guarantee of future returns.
        </p>
      </Section>
    </>
  );
}
