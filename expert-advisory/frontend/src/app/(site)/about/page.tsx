import type { Metadata } from "next";
import { 
  Award, 
  BarChart3, 
  CheckCircle2, 
  Compass, 
  Eye, 
  LineChart, 
  Mail, 
  MessageSquare,
  Phone, 
  ShieldCheck, 
  Sparkles, 
  Target, 
  TrendingUp, 
  Zap 
} from "lucide-react";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card, Container, LinkButton, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "About Us | Expert Stocks Consultancy",
  description: "Learn about Expert Stocks Consultancy - A cutting-edge fintech platform providing stock market advisory, portfolio management, and SEBI-aligned market research.",
  alternates: { canonical: "/about" },
};

const STATS = [
  { value: "25+", label: "Years Experience", description: "In-depth expertise navigating Indian capital markets." },
  { value: "150+", label: "Expert Strategies", description: "Data-driven research reports and actionable insights." },
  { value: "1:2.5+", label: "Risk-Reward Discipline", description: "Predefined invalidation levels and momentum models." },
  { value: "24/7", label: "Dedicated Support", description: "Multi-channel assistance for active traders and investors." },
];

const TECHNICAL_PILLARS = [
  {
    icon: LineChart,
    title: "Chart & Candlestick Analysis",
    description: "Interpreting candlestick patterns, multi-timeframe price action, support & resistance levels, and dynamic trend lines for accurate market direction.",
  },
  {
    icon: BarChart3,
    title: "Advanced Technical Indicators",
    description: "Utilizing RSI, MACD, Bollinger Bands, Moving Averages (EMA 20/50/200), and Fibonacci Retracements to confirm trend strength and exhaustions.",
  },
  {
    icon: Zap,
    title: "Market Sentiment & Volume Dynamics",
    description: "Tracking institutional volume profiles, order flow, and momentum shifts to spot breakouts and trend reversals before they unfold.",
  },
  {
    icon: Target,
    title: "Customized Trading Strategies",
    description: "Crafting structured intraday setups, high-momentum swing trades, and long-term positional models tailored to varying capital scales.",
  },
  {
    icon: ShieldCheck,
    title: "Disciplined Risk Management",
    description: "Implementing strict stop-loss rules, systematic position sizing, and calculated risk-to-reward ratios to minimize downside and preserve capital.",
  },
  {
    icon: Sparkles,
    title: "Multi-Segment Asset Coverage",
    description: "Comprehensive research across Indian platforms including NSE, BSE equities, NFO index and stock options, as well as MCX and NCDEX commodities.",
  },
];

const WHY_CHOOSE_US = [
  {
    title: "Accuracy & Reliability",
    description: "Every recommendation is backed by thorough quantitative backtesting and years of hands-on trading experience.",
  },
  {
    title: "Real-Time Market Updates",
    description: "Stay ahead of rapid intraday developments with live alerts, key market pivots, and timely entry/exit notifications.",
  },
  {
    title: "Customized Trading Plans",
    description: "Tailored strategies aligned with your specific risk appetite, capital allocation, and individual wealth-building goals.",
  },
  {
    title: "Continuous Learning & Tech Adaptation",
    description: "We constantly evolve our algorithmic models and analytical software to thrive in changing market regimes.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero Banner */}
      <PageHero
        eyebrow="Institutional Equity and Derivative Market Research"
        title="About Expert Stocks Consultancy"
        lead="A cutting-edge fintech platform dedicated to delivering seamless financial consultation, stock market advisory, portfolio management, and rigorous market research across Indian capital markets."
      />

      {/* High-Impact Trust Metrics */}
      <Section className="border-b border-ink-100 bg-white py-12">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center sm:text-left">
              <p className="font-mono text-3xl font-extrabold tracking-tight text-teal-600 sm:text-4xl">
                {stat.value}
              </p>
              <h3 className="mt-1 text-base font-bold text-ink-950">{stat.label}</h3>
              <p className="mt-1 text-xs text-ink-600 leading-relaxed">{stat.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Main Company Story */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-5 text-base leading-7 text-ink-700">
            <Badge tone="teal" className="mb-2">Empowering Traders & Investors</Badge>
            <h2 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              Simplifying Stock Market Success Through Data and Discipline
            </h2>
            <p>
              <strong>Expert Stocks Consultancy</strong> is a specialized financial consultation and market intelligence firm. We specialize in <strong>stock market advisory, portfolio management, and market research</strong>, ensuring that our clients receive the best strategies tailored to their unique investment horizons.
            </p>
            <p>
              Our journey began with a clear mission: to simplify investing for everyone. Today, we pride ourselves on being a trusted destination for both active traders and long-term investors. We provide structured guidance across <strong>equity cash, index & stock options, futures, and mutual funds</strong>, backed by deep technical and quantitative market research.
            </p>
            <p>
              With a team of seasoned analysts and portfolio researchers, we focus on crafting strategies that strictly match your financial goals and risk tolerance. Recognized among the fastest-growing stock advisory firms in India, we are committed to transparency, disciplined execution, and delivering a standout experience in every interaction.
            </p>
            <div className="pt-2 flex flex-wrap gap-4">
              <LinkButton href="/services">Explore Our Advisory Services</LinkButton>
              <LinkButton href="/testimonials" variant="secondary">View Client Portfolio Reviews</LinkButton>
            </div>
          </div>

          <div className="lg:col-span-5">
            <Card className="p-8 space-y-6 bg-gradient-to-br from-white to-ink-50/50 border border-ink-200/80 shadow-md">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <Target className="size-5" />
                  </div>
                  <h3 className="text-xl font-bold text-ink-950">Our Mission</h3>
                </div>
                <p className="text-sm leading-6 text-ink-600">
                  At <strong>Expert Stocks Consultancy</strong>, we work continuously on training and updating our analytical staff, adopting modern technology, and refining market models to benefit our clients. Equipped with highly reliable market software, analytical newswires, and qualified representatives, we protect clients&apos; capital and help them build sustainable wealth.
                </p>
              </div>

              <hr className="border-ink-100" />

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Compass className="size-5" />
                  </div>
                  <h3 className="text-xl font-bold text-ink-950">Our Vision</h3>
                </div>
                <p className="text-sm leading-6 text-ink-600">
                  We strive to be acknowledged as a benchmark in client satisfaction, risk-aware performance, and analytical depth in India&apos;s financial markets. We continuously enhance our reputation for accessibility, professionalism, and enduring consultative partnerships with our clients.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </Section>

      {/* Technical Analyst Expertise & Approach */}
      <Section tone="muted">
        <SectionHeading
          eyebrow="Technical Analysis & Research"
          title="Our Experienced Technical Analysis Approach"
          lead="At Expert Stocks Consultancy, our analytical desk delivers data-driven market insights and precision-based trading strategies across Indian equity and derivative platforms."
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TECHNICAL_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Card key={pillar.title} className="p-6 transition-all hover:shadow-lg">
                <div className="flex size-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-ink-950">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">{pillar.description}</p>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Why Choose Us */}
      <Section>
        <SectionHeading
          eyebrow="The Expert Stocks Advantage"
          title="Why Choose Our Market Advisory?"
          lead="Whether you are an intraday trader or an HNI investor, our structured methodology provides an institutional edge in the market."
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {WHY_CHOOSE_US.map((item, i) => (
            <Card key={item.title} className="p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-teal-500/10 font-mono text-xs font-bold text-teal-700">
                  0{i + 1}
                </span>
                <h3 className="text-lg font-semibold text-ink-950">{item.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-600">{item.description}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Direct Contact & Advisory Desk */}
      <Section tone="muted">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge tone="teal" className="mb-3">Connect With Us</Badge>
            <h2 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              Elevate Your Trading Journey with Expert Technical Analysis
            </h2>
            <p className="mt-3 text-base text-ink-700">
              Partner with our advisory desk today to identify high-probability setups and manage portfolio risks with confidence.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-ink-800">
              <a
                href="https://wa.me/919589615649"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-medium text-emerald-600 hover:text-emerald-700"
              >
                <MessageSquare className="size-4 text-emerald-600" />
                Chat on WhatsApp
              </a>
              <a href="mailto:info@expertstocks.in" className="inline-flex items-center gap-2 font-medium hover:text-teal-600">
                <Mail className="size-4 text-teal-600" />
                info@expertstocks.in
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 lg:justify-end">
            <LinkButton href="/contact">Schedule a Consultation</LinkButton>
            <LinkButton href="/disclaimer" variant="secondary">View Regulatory Disclaimer</LinkButton>
          </div>
        </div>
      </Section>

      {/* Statutory Regulatory Notice */}
      <Section className="py-8 bg-ink-50 border-t border-ink-100 text-xs text-ink-500 leading-relaxed">
        <p>
          <strong>Regulatory Notice:</strong> Investment in securities market are subject to market risks. Read all related documents carefully before investing. Registration granted by SEBI, membership of BASL and certification from NISM in no way guarantees performance of the intermediary or provide any assurance of returns to investors.
        </p>
      </Section>
    </>
  );
}
