"use client";

import { AlertTriangle, ShieldX, TrendingDown, Clock, Scale } from "lucide-react";
import Link from "next/link";
import { Container, Eyebrow } from "../ui";
import { TRUST_CONFIG } from "@/lib/trust-config";

export function RiskFirstSection() {
  const riskFactors = [
    {
      id: "market",
      title: "MARKET RISK",
      subtitle: "Systemic beta & macroeconomic shifts",
      desc: "Broader market indices are vulnerable to geopolitical shocks, currency depreciation, and interest rate cycle changes that impact asset prices regardless of individual stock quality.",
      metric: "Systemic Factor",
      icon: TrendingDown,
    },
    {
      id: "derivative",
      title: "DERIVATIVE RISK",
      subtitle: "Non-linear payoff & theta decay",
      desc: "Futures and options contracts carry asymmetrical payoff dynamics. Long option buyers experience continuous time decay (theta), while naked option sellers face mathematically uncapped downside.",
      metric: "Asymmetric Hazard",
      icon: AlertTriangle,
    },
    {
      id: "volatility",
      title: "VOLATILITY RISK",
      subtitle: "Implied Volatility (IV) crush",
      desc: "Prior to major corporate earnings or monetary policy decisions, implied volatility elevates option premiums. Post-event IV collapse can erase contract value even if directional thesis proves correct.",
      metric: "Vega Compression",
      icon: Clock,
    },
    {
      id: "liquidity",
      title: "LIQUIDITY RISK",
      subtitle: "Bid-ask spread slippage",
      desc: "Out-of-the-money or far-month contracts frequently suffer from wide spreads between best bid and best ask. Market order executions in illiquid strikes incur substantial immediate slippage cost.",
      metric: "Execution Friction",
      icon: Scale,
    },
    {
      id: "leverage",
      title: "LEVERAGE RISK",
      subtitle: "Margin multiplier drawdowns",
      desc: "Trading with excessive leverage amplifies percentage gains and losses equally. Under adverse volatility spikes, account equity can deplete rapidly without disciplined position-sizing limits.",
      metric: "Capital Depletion Risk",
      icon: ShieldX,
    },
  ];

  return (
    <section className="relative py-16 lg:py-24 bg-[#080D14] border-b border-[#1C2734]">
      {/* Restrained Amber Ambient Glow */}
      <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 size-96 rounded-full bg-[#F5B84B]/5 blur-[120px]" />

      <Container className="relative z-10">
        {/* Header */}
        <div className="max-w-3xl mb-16">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#F5B84B] mb-3">
            <AlertTriangle className="size-4" />
            <span>Risk-First Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight text-balance">
            Understand the risk before the opportunity.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] leading-relaxed text-pretty">
            Quantitative discipline dictates that capital preservation supersedes speculative return targets. Every participant must comprehend the structural risk factors governing Indian financial markets.
          </p>
        </div>

        {/* 5 Risk Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {riskFactors.map((rf) => {
            const Icon = rf.icon;

            return (
              <div
                key={rf.id}
                className="group flex flex-col justify-between rounded-xl border border-[#1C2734] bg-[#0D131C] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[#F5B84B]/40 hover:shadow-[0_12px_28px_-10px_rgba(245,184,75,0.1)]"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="grid size-9 place-items-center rounded-lg border border-[#F5B84B]/30 bg-[#F5B84B]/10 text-[#F5B84B]">
                      <Icon className="size-4.5" />
                    </div>
                    <span className="font-mono text-[9px] font-semibold text-[#F5B84B] bg-[#F5B84B]/10 px-2 py-0.5 rounded">
                      {rf.metric}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold font-display text-[#F5F7FA]">
                    {rf.title}
                  </h3>
                  <div className="text-[10px] font-mono text-[#667383] mt-0.5">
                    {rf.subtitle}
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-[#9AA7B5]">
                    {rf.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[#1C2734]">
                  <Link
                    href="/legal/risk-disclosure"
                    className="text-[11px] font-mono font-semibold text-[#F5B84B] hover:text-white transition-colors"
                  >
                    Read Warning Details →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Prominent Statutory Warning Banner */}
        <div className="mt-12 rounded-2xl border border-[#F05252]/40 bg-[#0D131C] p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#F05252] uppercase tracking-wider">
                <ShieldX className="size-4" />
                <span>Statutory Regulatory Notice (SEBI Mandate)</span>
              </div>
              <p className="text-sm text-[#F5F7FA] font-medium leading-relaxed max-w-4xl">
                {TRUST_CONFIG.statutoryNotice}
              </p>
              <p className="text-xs text-[#9AA7B5] leading-relaxed max-w-4xl pt-1">
                According to SEBI study on derivative trading, 9 out of 10 individual traders in equity F&O segment incurred net losses, with an average loss of over ₹50,000 per loss-making trader. Over and above net trading losses, loss makers expended an additional 15% to 28% of net trading losses in transaction costs. Past performance does not guarantee future results.
              </p>
            </div>

            <div className="shrink-0">
              <Link
                href="/legal/risk-disclosure"
                className="inline-flex items-center justify-center rounded-lg border border-[#F05252]/50 bg-[#F05252]/10 px-5 py-2.5 text-xs font-mono font-semibold text-[#F05252] hover:bg-[#F05252]/20 transition-colors whitespace-nowrap"
              >
                Inspect Complete Risk Disclosure
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
