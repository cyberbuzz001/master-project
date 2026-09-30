import type { Metadata } from "next";
import { 
  AlertCircle, 
  BarChart2, 
  BookOpen, 
  BrainCircuit, 
  Calendar, 
  CheckSquare, 
  HelpCircle, 
  LineChart, 
  PieChart, 
  ShieldAlert, 
  Sparkles, 
  TrendingDown, 
  TrendingUp 
} from "lucide-react";
import Link from "next/link";
import { LeadForm } from "@/components/site/LeadForm";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card, Container, LinkButton, Notice, SectionHeading } from "@/components/ui";
import { getSiteData } from "@/lib/api-server";

export const metadata: Metadata = {
  title: "Educational Resources & Guides | Expert Stocks Consultancy",
  description: "Comprehensive guides on risk management, derivatives, technical analysis, and how to read market research reports.",
  alternates: { canonical: "/resources" },
};

const GUIDES = [
  {
    icon: BookOpen,
    category: "Basics",
    title: "Beginner's Guide to Indian Markets",
    summary: "How exchange trading, order types (Limit, Market, SL-M), rolling T+1 settlements, and statutory transaction costs work across NSE and BSE.",
    keyTakeaway: "Always factor in statutory levies (STT, Exchange turnover charges, GST) into your net profit expectations.",
  },
  {
    icon: ShieldAlert,
    category: "Risk Control",
    title: "Disciplined Risk-Management & Position Sizing",
    summary: "The mathematical rule of risking only 1% to 2% of total trading capital per trade, setting predefined stop-losses, and avoiding overleverage.",
    keyTakeaway: "Capital preservation is the foundation of long-term profitability. Never risk capital you cannot afford to lose.",
  },
  {
    icon: TrendingDown,
    category: "Derivatives",
    title: "Options Volatility & Time Decay (Theta) Guide",
    summary: "Understanding how option premiums lose value rapidly as expiration nears, the role of Implied Volatility (IV), and why OTM options often expire worthless.",
    keyTakeaway: "Time decay accelerates in the final 48 hours before expiry. Option buyers must prioritize momentum over hope.",
  },
  {
    icon: LineChart,
    category: "Technical Analysis",
    title: "Core Technical Indicators Explained",
    summary: "What common indicators (RSI, Moving Average crossovers 20/50/200 EMA, MACD, and Bollinger Bands) really measure—and their inherent lagging limitations.",
    keyTakeaway: "Indicators confirm price structure; they do not dictate it. Always anchor your primary thesis on price action and volume.",
  },
  {
    icon: CheckSquare,
    category: "Research",
    title: "How to Read a Research Report",
    summary: "Deconstructing an institutional research note: entry zones, target rationales, time horizon, stop-loss invalidation conditions, and conflict disclosures.",
    keyTakeaway: "A research note is invalid if the stop-loss level is breached. Never hold losing speculative trades into long-term investments.",
  },
  {
    icon: HelpCircle,
    category: "Due Diligence",
    title: "Investor Pre-Trade Checklist",
    summary: "A practical 6-point checklist to review before executing any trade: setup alignment, risk-to-reward ratio, news calendar, position size, and mental readiness.",
    keyTakeaway: "If a trade does not offer at least a 1:2 risk-to-reward ratio, it is not worth taking.",
  },
  {
    icon: BrainCircuit,
    category: "Psychology",
    title: "Mastering Trading Psychology & Bias",
    summary: "Recognizing destructive emotional habits such as revenge trading after a loss, FOMO (fear of missing out), overtrading, and premature profit-taking.",
    keyTakeaway: "A winning trading system fails in the hands of an undisciplined mind. Trade the plan, not your emotions.",
  },
  {
    icon: Calendar,
    category: "Market Events",
    title: "Navigating the Market Event Calendar",
    summary: "How scheduled macroeconomic data (RBI MPC interest rate decisions, US Fed policy, CPI inflation prints, quarterly corporate results) impact volatility.",
    keyTakeaway: "Options volatility spikes ahead of major binary events. Risk-averse traders avoid unhedged directional bets before high-impact announcements.",
  },
];

export default async function ResourcesPage() {
  const site = await getSiteData();

  return (
    <>
      <PageHero
        eyebrow="Knowledge & Discipline"
        title="Investor education & market guides"
        lead="Clear, practical educational resources designed to build risk awareness, analytical depth, and disciplined trading habits in Indian capital markets."
      >
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/risk-assessment">Take the Risk Assessment</LinkButton>
          <LinkButton href="/methodology" variant="secondary">
            Our Research Methodology
          </LinkButton>
        </div>
      </PageHero>

      {/* Guides Grid */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="grid gap-6 sm:grid-cols-2">
              {GUIDES.map((guide) => {
                const Icon = guide.icon;
                return (
                  <Card key={guide.title} className="flex flex-col justify-between p-6 transition-all hover:shadow-md">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                          <Icon className="size-5" />
                        </div>
                        <Badge tone="neutral">{guide.category}</Badge>
                      </div>

                      <h3 className="mt-4 text-base font-bold text-ink-950">{guide.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-ink-600">{guide.summary}</p>
                    </div>

                    <div className="mt-5 rounded-lg bg-ink-50 p-3 border border-ink-100">
                      <p className="text-[11px] font-semibold text-ink-800">
                        <span className="text-teal-700">Key Rule:</span> {guide.keyTakeaway}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Notice tone="neutral" className="mt-8" title="Educational Purpose Only">
              All guides and resources published on this page are intended exclusively for educational and informational purposes. They do not constitute financial advice, buy/sell recommendations, or performance assurances.
            </Notice>
          </div>

          {/* Lead / Notification Form */}
          <div className="space-y-6">
            <Card className="p-6 sm:p-8">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-5 text-teal-600" />
                <h3 className="text-lg font-bold text-ink-950">Receive Research & Updates</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-600">
                Subscribe to receive our latest educational whitepapers, weekly sector reviews, and pre-market commentary directly in your inbox.
              </p>
              <div className="mt-6">
                <LeadForm
                  formKey="resource_download"
                  consentText={site.ok ? site.data.consent_text : null}
                  submitLabel="Get Educational Updates"
                  showMessage={false}
                  compact
                />
              </div>
            </Card>

            <Card className="p-6">
              <h4 className="text-sm font-bold text-ink-950">Looking for live market advisory?</h4>
              <p className="mt-1.5 text-xs text-ink-600 leading-relaxed">
                Explore our research plans across Equity Cash, Index Options, Stock Futures, and HNI Wealth Generator strategies.
              </p>
              <LinkButton href="/pricing" variant="secondary" size="sm" className="mt-4 w-full justify-center">
                Explore Advisory Plans →
              </LinkButton>
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}
