import { AlertTriangle, TrendingDown, Clock, ShieldAlert, ArrowDown, Zap } from "lucide-react";

export function RiskDisclosureView() {
  return (
    <div className="space-y-10 text-[#F5F7FA]">
      {/* Prominent Warning Callout Panel */}
      <div className="rounded-2xl border-2 border-[#F59E0B]/30 bg-[#161208]/90 p-5 sm:p-6 shadow-[0_0_30px_rgba(245,158,11,0.08)]">
        <div className="flex items-start gap-4">
          <div className="size-10 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B] shrink-0 mt-0.5">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold font-mono uppercase tracking-wider text-[#F59E0B] flex items-center gap-2">
              <span>Statutory Warning · Capital Risk Acknowledgment</span>
            </h2>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#F5F7FA]">
              Trading and investing in the Indian securities market (NSE, BSE, MCX) involves substantial risk of capital loss. Prior to executing transactions or subscribing to research publications, you must thoroughly evaluate your financial situation and risk tolerance.
            </p>
            <p className="mt-2 text-xs font-mono text-[#F59E0B]/90">
              Mandatory disclosure under SEBI (Research Analysts) Regulations, 2014.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 01: Market Volatility & Capital Loss */}
      <section id="market-volatility" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            01
          </span>
          <span className="uppercase tracking-widest">Equity Market Dynamics</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Market Volatility & Capital Loss
        </h3>

        <div className="mt-4 space-y-4 text-sm sm:text-base leading-relaxed text-[#9AA7B5]">
          <p>
            Security prices fluctuate continually based on macroeconomic conditions, corporate earnings, central bank interest rate policies, domestic inflation metrics, and unforeseen global geopolitical events.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
              <div className="text-xs font-mono font-semibold text-[#F5F7FA] mb-1">
                Downside Principle
              </div>
              <p className="text-xs text-[#9AA7B5] leading-normal">
                An investment can decline in value substantially. Historical price patterns, backtests, and technical setups do not guarantee future performance.
              </p>
            </div>
            <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
              <div className="text-xs font-mono font-semibold text-[#F5F7FA] mb-1">
                Risk Capital Rule
              </div>
              <p className="text-xs text-[#9AA7B5] leading-normal">
                You should only commit risk capital that you can afford to lose completely without compromising your day-to-day liquidity, emergency reserves, or living standard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 02: Derivative Trading Risks (F&O) */}
      <section id="derivatives-risk" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#F05252] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            02
          </span>
          <span className="uppercase tracking-widest">High-Risk Derivatives Segment</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Derivative Trading Risks (Futures & Options)
        </h3>

        <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#9AA7B5]">
          Exchange-traded index and equity derivatives possess structural operational characteristics that entail heightened financial risk:
        </p>

        {/* 3 Mini Cards */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="rounded-xl border border-[#F05252]/30 bg-[#161214] p-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#F05252] mb-2 uppercase tracking-wide">
              <Zap className="size-3.5" />
              <span>Leverage Risk</span>
            </div>
            <p className="text-xs text-[#9AA7B5] leading-relaxed">
              Futures and options contracts require initial margin that is a small fraction of total contract value. Leverage magnifies both gains and downside losses equally.
            </p>
          </div>

          <div className="rounded-xl border border-[#F59E0B]/30 bg-[#16140e] p-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#F59E0B] mb-2 uppercase tracking-wide">
              <Clock className="size-3.5" />
              <span>Time Decay (Theta)</span>
            </div>
            <p className="text-xs text-[#9AA7B5] leading-relaxed">
              Option buyers face non-linear time decay that accelerates rapidly toward weekly and monthly expiry dates, eroding premium even in sideways markets.
            </p>
          </div>

          <div className="rounded-xl border border-[#F05252]/30 bg-[#161214] p-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#F05252] mb-2 uppercase tracking-wide">
              <TrendingDown className="size-3.5" />
              <span>Capital Loss</span>
            </div>
            <p className="text-xs text-[#9AA7B5] leading-relaxed">
              Out-of-the-money (OTM) options can expire completely worthless at settlement, resulting in a total 100% loss of the premium paid.
            </p>
          </div>
        </div>

        {/* SEBI Study Callout Card */}
        <div className="mt-6 rounded-xl border border-[#1C2734] bg-[#080D14] p-5">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#43D9FF] mb-2">
            <ShieldAlert className="size-4" />
            <span>Official SEBI Analytical Study Notice on Equity F&O Traders</span>
          </div>
          <div className="space-y-2 text-xs font-mono text-[#9AA7B5] pt-1">
            <div className="flex items-start gap-2">
              <span className="text-[#F05252] font-bold">▪</span>
              <span><strong>9 out of 10</strong> individual traders in the equity F&O segment incurred net financial losses.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#F05252] font-bold">▪</span>
              <span>On average, loss-makers registered net trading losses close to <strong>₹50,000 per year</strong>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#F05252] font-bold">▪</span>
              <span>Active traders incurred an additional <strong>15% to 28%</strong> of net trading losses in transactional and advisory overheads.</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 03: Stop-Loss & Slippage Limitations */}
      <section id="slippage-limitations" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            03
          </span>
          <span className="uppercase tracking-widest">Execution Reality</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Stop-Loss & Slippage Limitations
        </h3>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
            <p>
              Reference stop-loss levels, invalidation thresholds, and price targets provided in research publications are theoretical directional markers.
            </p>
            <p>
              During periods of extreme market volatility, overnight macroeconomic announcements, market gap openings, or diminished liquidity, exchange matching engines may execute orders materially different from theoretical reference levels (slippage).
            </p>
            <p className="text-xs font-mono text-[#667383]">
              Stop-loss trigger orders turn into market orders once triggered and execute at whatever best available quote the exchange order book provides.
            </p>
          </div>

          {/* Execution Diagram */}
          <div className="lg:col-span-5 rounded-xl border border-[#1C2734] bg-[#080D14] p-5 font-mono text-xs">
            <div className="text-[11px] text-[#667383] uppercase tracking-wider mb-4 text-center">
              Exchange Execution Gap Model
            </div>
            
            <div className="space-y-3">
              {/* Expected Price Marker */}
              <div className="flex items-center justify-between border-b border-dashed border-[#43D9FF]/40 pb-2">
                <span className="text-[#43D9FF] font-semibold">EXPECTED STOP LEVEL</span>
                <span className="text-[#F5F7FA]">₹25,200.00</span>
              </div>

              {/* Market Gap Down Indicator */}
              <div className="flex items-center justify-center gap-2 py-2 text-[#F05252] bg-[#F05252]/5 rounded border border-[#F05252]/20">
                <ArrowDown className="size-3.5 animate-bounce" />
                <span className="text-[11px] tracking-widest uppercase font-bold">Market Opening Gap (-1.2%)</span>
              </div>

              {/* Actual Execution Marker */}
              <div className="flex items-center justify-between border-t border-dashed border-[#F05252]/40 pt-2">
                <span className="text-[#F05252] font-semibold">ACTUAL FILL (SLIPPAGE)</span>
                <span className="text-[#F05252]">₹24,898.00</span>
              </div>
            </div>

            <div className="mt-4 text-[10px] text-center text-[#667383] leading-normal">
              Exchange trades occurred across gap; fill price was below intended stop reference.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
