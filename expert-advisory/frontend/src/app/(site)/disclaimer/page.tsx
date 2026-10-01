import type { Metadata } from "next";
import { AlertTriangle, Cpu, HelpCircle, Mail, Phone, ShieldAlert, TrendingDown } from "lucide-react";
import { PageHero, Section } from "@/components/site/PageHero";
import { Badge, Card, Container, LinkButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Disclaimer & Risk Disclosure | Expert Stocks Consultancy",
  description: "Comprehensive statutory disclaimer, risk disclosure, and terms regarding financial market analysis, futures, and options trading.",
  alternates: { canonical: "/disclaimer" },
};

const RISK_CATEGORIES = [
  {
    icon: Cpu,
    title: "1. Risks Associated with Electronic Trading",
    paragraphs: [
      "Before you begin carrying out transactions with an electronic system, you should carefully review the rules and provisions of the stock exchange offering the system, or of the financial instruments listed that you intend to trade, as well as your broker's conditions.",
      "Online trading has inherent risks due to system responses, reaction times, and access times that may vary due to market conditions, network latency, system performance, and third-party software factors on which you have no influence. You should be fully aware of these technical and connectivity risks in electronic trading before carrying out investment transactions.",
    ],
  },
  {
    icon: ShieldAlert,
    title: "2. Risks Associated with the Stock Market",
    paragraphs: [
      "All opinions, news, investigations, analyses, prices, or other information offered by Expert Stocks Consultancy are provided in the form of general remarks, market commentary, and research analysis. They do not constitute individualized investment advice.",
      "Expert Stocks Consultancy assumes no liability for loss or damage, including without limitation, any loss of profit that may result directly or indirectly from the use or reliance on such opinions, analyses, or research reports.",
      "All financial investments involve substantial financial risk. The past performance of a security, an industry, a sector, an index, a financial product, or an individual trading strategy does not guarantee future results or returns. As an investor or trader, you bear the sole responsibility for your investment decisions.",
    ],
  },
  {
    icon: TrendingDown,
    title: "3. Risks Associated with Futures Trading (High Leverage)",
    paragraphs: [
      "Futures contracts involve high risk. The amount of initial margin is low compared to the total notional value of the futures contract, making transactions highly leveraged or geared.",
      "A relatively small market price movement has a proportionately larger impact on the funds deposited: this can work both for you and against you. You may experience the total loss of initial margin funds as well as additional funds deposited.",
      "If the market moves contrary to your open position or if exchange margins are increased, you may be required to deposit substantial additional funds at short notice. Failure to do so may result in your broker squaring off your position at a loss.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "4. Risks Associated with Options Trading",
    paragraphs: [
      "Trading in options involves significant risk and is not suitable for all investors. Option contracts (especially near-expiry or zero-day contracts) can lose their entire premium value rapidly due to time decay (theta) and adverse volatility changes.",
      "For option sellers (writers), risk is theoretically unlimited and potential losses can substantially exceed initial capital. You should carefully evaluate whether options trading is appropriate for you in light of your financial resources, experience, and risk tolerance.",
      "Past performance gives no indication of future results, and no guarantee or promise of profitability can be made.",
    ],
  },
];

export default function DisclaimerPage() {
  return (
    <>
      <PageHero
        eyebrow="Statutory Regulatory Disclosure"
        title="Disclaimer & Risk Policy"
        lead="Please read this regulatory disclaimer and market risk policy carefully before engaging with any research, strategies, or advisory recommendations published by Expert Stocks Consultancy."
      />

      {/* Primary SEBI Tie-up Banner */}
      <Section className="py-10 bg-amber-500/10 border-b border-amber-500/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-3">
            <Badge tone="warning">Essential Regulatory Notice</Badge>
            <h2 className="text-lg font-bold text-ink-950 sm:text-xl">
              Research Analyst Association & Liability Notice
            </h2>
            <p className="text-sm leading-relaxed text-ink-800">
              <strong>Expert Stocks Consultancy is not a standalone SEBI Certified Research entity. Expert Stocks Consultancy has tied up with a SEBI Certified Research Analyst who is authorized by the market regulator to publish research recommendations.</strong>
            </p>
            <p className="text-sm leading-relaxed text-ink-700">
              Expert Stocks Consultancy is in no way responsible for any profit or loss of any investors who invest based on the research provided on this platform. Investors must independently assess their risk profile and financial capacity before acting on any research. Expert Stocks Consultancy or any of its associates and representatives are not liable to any claims arising out of profit or loss on research circulated on its portal, website, or mobile application.
            </p>
          </div>
        </div>
      </Section>

      {/* General Disclaimer Clauses */}
      <Section>
        <div className="space-y-8">
          <Card className="p-6 sm:p-8 space-y-4 border border-[#1C2734] bg-[#0D131C]">
            <h3 className="text-xl font-bold text-[#F5F7FA] font-display">Exclusion of Investment Advice & Liability</h3>
            <p className="text-sm leading-7 text-[#9AA7B5]">
              Any and all liability for risks resulting from investment transactions or asset dispositions carried out by the customer based on information received or market analysis is expressly excluded. All information made available here is provided to serve as educational analysis and commentary only, without obligation and without specific recommendations for action. <strong className="text-[#F5F7FA]">It does not constitute and cannot replace personal financial advice. We recommend that you consult your certified financial planner or tax advisor before carrying out specific financial commitments.</strong>
            </p>
            <p className="text-sm leading-7 text-[#9AA7B5]">
              In view of high volatility and market complexity, you should only trade in securities and derivatives if you fully understand the nature of the contracts, exchange rules, and have evaluated your total downside potential.
            </p>
          </Card>

          {/* Detailed Risk Categories */}
          <div className="grid gap-6 md:grid-cols-2">
            {RISK_CATEGORIES.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="p-6 sm:p-8 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-ink-100 text-ink-800">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="text-base font-bold text-ink-950">{item.title}</h3>
                  </div>
                  <div className="space-y-3 text-sm leading-relaxed text-ink-600">
                    {item.paragraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* No Guarantees Clause */}
          <Card className="p-6 sm:p-8 bg-ink-950 text-white space-y-4">
            <h3 className="text-lg font-bold text-white">No Guarantees or Profit Assurances</h3>
            <p className="text-sm leading-relaxed text-ink-300">
              In view of the above risks, no guarantee, warranty, or promise can be given for the success, return, or profitability of any investment or trade. By using this website, portal, and advisory feeds, you expressly acknowledge and agree that Expert Stocks Consultancy cannot be held liable for any damages, drawdowns, or capital losses.
            </p>
            <p className="text-xs leading-relaxed text-ink-400">
              None of the information on this site constitutes an invitation, solicitation, or offer to buy or sell securities, commodities, or financial instruments of any kind.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs text-ink-300">
              <span className="flex items-center gap-1.5"><Phone className="size-3.5 text-teal-400" /> +91 92388 37041</span>
              <span className="flex items-center gap-1.5"><Mail className="size-3.5 text-teal-400" /> info@expertstocks.in</span>
            </div>
          </Card>
        </div>
      </Section>

      {/* Statutory Regulatory Notice */}
      <Section className="py-8 bg-ink-50 border-t border-ink-100 text-xs text-ink-500 leading-relaxed">
        <p>
          <strong>SEBI Mandatory Warning:</strong> Investment in securities market are subject to market risks. Read all related documents carefully before investing. Registration granted by SEBI, membership of BASL and certification from NISM in no way guarantees performance of the intermediary or provide any assurance of returns to investors.
        </p>
      </Section>
    </>
  );
}
