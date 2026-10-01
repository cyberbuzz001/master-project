"use client";

import { useState } from "react";
import { Calculator, Percent, ShieldCheck, DollarSign, TrendingUp, PieChart, Info } from "lucide-react";
import { Container, Eyebrow } from "../ui";

export function FinancialToolsHub() {
  const [activeTool, setActiveTool] = useState<"position" | "rr" | "options" | "brokerage" | "cagr" | "portfolio">("position");

  // 1. Position Size State
  const [capital, setCapital] = useState(500000);
  const [riskPct, setRiskPct] = useState(1.5);
  const [entryPrice, setEntryPrice] = useState(2500);
  const [slPrice, setSlPrice] = useState(2425);

  const riskAmount = (capital * riskPct) / 100;
  const riskPerShare = Math.max(0.1, entryPrice - slPrice);
  const calculatedShares = Math.floor(riskAmount / riskPerShare);
  const positionValue = calculatedShares * entryPrice;

  // 2. Risk/Reward State
  const [rrEntry, setRrEntry] = useState(1500);
  const [rrTarget, setRrTarget] = useState(1650);
  const [rrStop, setRrStop] = useState(1450);

  const rewardPts = Math.max(0, rrTarget - rrEntry);
  const riskPts = Math.max(0.1, rrEntry - rrStop);
  const rrRatio = (rewardPts / riskPts).toFixed(2);
  const breakevenWinRate = ((1 / (1 + parseFloat(rrRatio))) * 100).toFixed(1);

  // 3. Options Greeks Estimator State
  const [spotPrice, setSpotPrice] = useState(25400);
  const [strikePrice, setStrikePrice] = useState(25500);
  const [dte, setDte] = useState(7);
  const [iv, setIv] = useState(14);

  const moneyness = spotPrice / strikePrice;
  const approxCallDelta = Math.min(0.99, Math.max(0.01, 0.5 + (spotPrice - strikePrice) / (spotPrice * (iv / 100) * Math.sqrt(dte / 365) * 2))).toFixed(2);
  const approxTheta = (-((spotPrice * (iv / 100)) / (2 * Math.sqrt(dte || 1) * 10))).toFixed(1);

  // 4. Brokerage & Charges State
  const [tradeTurnover, setTradeTurnover] = useState(200000);
  const [brokerageFlat] = useState(40); // 20 buy + 20 sell
  const stt = (tradeTurnover * 0.001).toFixed(1); // 0.1% for cash delivery
  const exchangeFees = (tradeTurnover * 0.0000325).toFixed(1);
  const gst = ((brokerageFlat + parseFloat(exchangeFees)) * 0.18).toFixed(1);
  const sebiCharges = (tradeTurnover * 0.000001).toFixed(1);
  const stampDuty = (tradeTurnover * 0.00015).toFixed(1);
  const totalTaxes = (brokerageFlat + parseFloat(stt) + parseFloat(exchangeFees) + parseFloat(gst) + parseFloat(sebiCharges) + parseFloat(stampDuty)).toFixed(1);

  // 5. CAGR State
  const [initialInv, setInitialInv] = useState(100000);
  const [finalInv, setFinalInv] = useState(250000);
  const [years, setYears] = useState(5);
  const cagr = (((Math.pow(finalInv / initialInv, 1 / Math.max(1, years)) - 1) * 100)).toFixed(2);

  // 6. Portfolio Allocation State
  const [riskProfile, setRiskProfile] = useState<"conservative" | "balanced" | "dynamic">("balanced");
  const allocation = {
    conservative: { equity: 30, debt: 50, gold: 10, cash: 10 },
    balanced: { equity: 55, debt: 25, gold: 10, cash: 10 },
    dynamic: { equity: 75, debt: 10, gold: 5, cash: 10 },
  }[riskProfile];

  return (
    <section id="tools" className="relative py-24 lg:py-32 bg-[#05070B] border-b border-[#1C2734]">
      <Container>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <Eyebrow className="mb-3">Institutional Utility Suite</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight">
              Market Tools & Quantitative Models
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] max-w-2xl leading-relaxed">
              Every decision begins with disciplined mathematics. Use our verified calculation engines for position sizing, risk-reward ratios, and statutory cost audits.
            </p>
          </div>
          <div className="text-xs font-mono text-[#667383]">
            Formulas: Transparent & Deterministic
          </div>
        </div>

        {/* 6 Tool Navigation Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-8">
          {[
            { id: "position", label: "Position Size", icon: Calculator },
            { id: "rr", label: "Risk / Reward", icon: ShieldCheck },
            { id: "options", label: "Options Greeks", icon: Percent },
            { id: "brokerage", label: "Taxes & Brokerage", icon: DollarSign },
            { id: "cagr", label: "CAGR Calculator", icon: TrendingUp },
            { id: "portfolio", label: "Asset Allocation", icon: PieChart },
          ].map((t) => {
            const Icon = t.icon;
            const isSelected = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id as any)}
                className={`flex items-center justify-center gap-2 rounded-xl p-3 text-xs font-mono font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#43D9FF] text-[#05070B] font-bold shadow-[0_0_20px_rgba(67,217,255,0.25)]"
                    : "border border-[#1C2734] bg-[#0D131C] text-[#9AA7B5] hover:border-[#283749] hover:text-[#F5F7FA]"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Calculator Container */}
        <div className="rounded-2xl border border-[#1C2734] bg-[#0D131C] p-6 lg:p-10 shadow-2xl">
          {/* 1. Position Size Calculator */}
          {activeTool === "position" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-6 space-y-4">
                <h3 className="text-xl font-bold font-display text-[#F5F7FA]">
                  Position Size & Risk-Per-Trade Model
                </h3>
                <p className="text-xs text-[#9AA7B5] leading-relaxed">
                  Controls capital exposure so no single adverse market move jeopardizes account longevity. Formula: <code className="text-[#43D9FF]">Qty = (Account Capital × Risk %) / (Entry - Stop Loss)</code>.
                </p>

                <div className="space-y-3 pt-2 text-xs font-mono">
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Total Account Capital (₹)</label>
                    <input
                      type="number"
                      value={capital}
                      onChange={(e) => setCapital(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] px-3.5 py-2 text-[#F5F7FA] focus:border-[#43D9FF] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Risk Percentage Per Trade: {riskPct}%</label>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.25"
                      value={riskPct}
                      onChange={(e) => setRiskPct(Number(e.target.value))}
                      className="w-full accent-[#43D9FF]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[#9AA7B5] block mb-1">Planned Entry Price (₹)</label>
                      <input
                        type="number"
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(Number(e.target.value))}
                        className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] px-3 py-2 text-[#F5F7FA] focus:border-[#43D9FF] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[#9AA7B5] block mb-1">Invalidation Stop Loss (₹)</label>
                      <input
                        type="number"
                        value={slPrice}
                        onChange={(e) => setSlPrice(Number(e.target.value))}
                        className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] px-3 py-2 text-[#F5F7FA] focus:border-[#43D9FF] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Position Size Results Panel */}
              <div className="lg:col-span-6 rounded-xl border border-[#1C2734] bg-[#080D14] p-6 text-xs font-mono space-y-4">
                <div className="text-[11px] text-[#43D9FF] font-semibold uppercase tracking-wider">
                  CALCULATED ALLOCATION BOUNDS
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#111923] p-3 border border-[#1C2734]">
                    <div className="text-[10px] text-[#667383]">MAX RISK AMOUNT</div>
                    <div className="text-base font-bold text-[#F05252] mt-0.5">
                      ₹{riskAmount.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#111923] p-3 border border-[#1C2734]">
                    <div className="text-[10px] text-[#667383]">RISK PER SHARE</div>
                    <div className="text-base font-bold text-[#F5B84B] mt-0.5">
                      ₹{riskPerShare.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-[#43D9FF]/40 bg-[#111923] p-4 text-center">
                  <div className="text-xs text-[#9AA7B5]">RECOMMENDED POSITION SIZE</div>
                  <div className="text-3xl font-bold font-mono text-[#43D9FF] my-1">
                    {calculatedShares} Shares
                  </div>
                  <div className="text-[11px] text-[#667383]">
                    Total Position Value: ₹{positionValue.toLocaleString("en-IN")} ({(positionValue / (capital || 1) * 100).toFixed(1)}% of capital)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Risk / Reward Calculator */}
          {activeTool === "rr" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-6 space-y-4">
                <h3 className="text-xl font-bold font-display text-[#F5F7FA]">
                  Risk to Reward & Breakeven Threshold
                </h3>
                <p className="text-xs text-[#9AA7B5] leading-relaxed">
                  Evaluates whether a trade setup offers sufficient asymmetrical payoff to justify capital risk. Institutional minimum threshold: 1 : 2.0.
                </p>

                <div className="space-y-3 pt-2 text-xs font-mono">
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Entry Price (₹)</label>
                    <input
                      type="number"
                      value={rrEntry}
                      onChange={(e) => setRrEntry(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] px-3.5 py-2 text-[#F5F7FA] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Target Price (₹)</label>
                    <input
                      type="number"
                      value={rrTarget}
                      onChange={(e) => setRrTarget(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] px-3.5 py-2 text-[#F5F7FA] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Stop Loss Price (₹)</label>
                    <input
                      type="number"
                      value={rrStop}
                      onChange={(e) => setRrStop(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] px-3.5 py-2 text-[#F5F7FA] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-xl border border-[#1C2734] bg-[#080D14] p-6 text-xs font-mono space-y-4">
                <div className="text-[11px] text-[#43D9FF] font-semibold uppercase tracking-wider">
                  ASYMMETRY METRICS
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#111923] p-3 border border-[#1C2734]">
                    <div className="text-[10px] text-[#667383]">REWARD POTENTIAL</div>
                    <div className="text-base font-bold text-[#22C55E] mt-0.5">+{rewardPts} pts</div>
                  </div>
                  <div className="rounded-lg bg-[#111923] p-3 border border-[#1C2734]">
                    <div className="text-[10px] text-[#667383]">RISK EXPOSURE</div>
                    <div className="text-base font-bold text-[#F05252] mt-0.5">-{riskPts} pts</div>
                  </div>
                </div>
                <div className="rounded-xl border border-[#43D9FF]/40 bg-[#111923] p-4 text-center">
                  <div className="text-xs text-[#9AA7B5]">RISK TO REWARD RATIO</div>
                  <div className="text-3xl font-bold font-mono text-[#43D9FF] my-1">
                    1 : {rrRatio}
                  </div>
                  <div className="text-[11px] text-[#22C55E] font-semibold">
                    Required Breakeven Win Rate: {breakevenWinRate}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Options Greeks Estimator */}
          {activeTool === "options" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-6 space-y-4">
                <h3 className="text-xl font-bold font-display text-[#F5F7FA]">
                  Options Greeks & Sensitivity Estimator
                </h3>
                <p className="text-xs text-[#9AA7B5] leading-relaxed">
                  Approximates option Delta (directional rate of change) and Theta (daily calendar decay) for European-style NIFTY options.
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Spot Price (₹)</label>
                    <input
                      type="number"
                      value={spotPrice}
                      onChange={(e) => setSpotPrice(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] p-2 text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Strike Price (₹)</label>
                    <input
                      type="number"
                      value={strikePrice}
                      onChange={(e) => setStrikePrice(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] p-2 text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Days to Expiry (DTE): {dte}d</label>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={dte}
                      onChange={(e) => setDte(Number(e.target.value))}
                      className="w-full accent-[#43D9FF]"
                    />
                  </div>
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Implied Volatility (IV): {iv}%</label>
                    <input
                      type="range"
                      min="8"
                      max="40"
                      value={iv}
                      onChange={(e) => setIv(Number(e.target.value))}
                      className="w-full accent-[#43D9FF]"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-xl border border-[#1C2734] bg-[#080D14] p-6 text-xs font-mono space-y-4">
                <div className="text-[11px] text-[#43D9FF] font-semibold uppercase tracking-wider">
                  DERIVATIVES GREEKS AUDIT
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#111923] p-3 border border-[#1C2734]">
                    <div className="text-[10px] text-[#667383]">ESTIMATED DELTA (Δ)</div>
                    <div className="text-xl font-bold text-[#43D9FF] mt-0.5">{approxCallDelta}</div>
                  </div>
                  <div className="rounded-lg bg-[#111923] p-3 border border-[#1C2734]">
                    <div className="text-[10px] text-[#667383]">DAILY THETA (Θ) DECAY</div>
                    <div className="text-xl font-bold text-[#F05252] mt-0.5">{approxTheta} pts/day</div>
                  </div>
                </div>
                <div className="text-[11px] text-[#667383] bg-[#111923] p-3 rounded-lg border border-[#1C2734] leading-relaxed">
                  Note: Black-Scholes approximations are for educational modeling. SEBI warns that options trading carries extreme non-linear risk.
                </div>
              </div>
            </div>
          )}

          {/* 4. Brokerage & Taxes Calculator */}
          {activeTool === "brokerage" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-6 space-y-4">
                <h3 className="text-xl font-bold font-display text-[#F5F7FA]">
                  Statutory Charges & Tax Audit
                </h3>
                <p className="text-xs text-[#9AA7B5] leading-relaxed">
                  Breakdown of statutory costs governing Indian trading (STT, GST, Exchange charges, SEBI turnover fees, Stamp Duty).
                </p>

                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Total Transaction Turnover (₹)</label>
                    <input
                      type="number"
                      value={tradeTurnover}
                      onChange={(e) => setTradeTurnover(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] px-3.5 py-2 text-[#F5F7FA] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-xl border border-[#1C2734] bg-[#080D14] p-6 text-xs font-mono space-y-2.5">
                <div className="flex justify-between pb-2 border-b border-[#1C2734]">
                  <span className="text-[#9AA7B5]">Securities Transaction Tax (STT 0.1%):</span>
                  <span className="text-[#F5F7FA]">₹{stt}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#1C2734]">
                  <span className="text-[#9AA7B5]">Exchange Transaction Charge:</span>
                  <span className="text-[#F5F7FA]">₹{exchangeFees}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#1C2734]">
                  <span className="text-[#9AA7B5]">GST (18% on Brokerage & Txn):</span>
                  <span className="text-[#F5F7FA]">₹{gst}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#1C2734]">
                  <span className="text-[#9AA7B5]">SEBI Turnover Charges & Stamp Duty:</span>
                  <span className="text-[#F5F7FA]">₹{(parseFloat(sebiCharges) + parseFloat(stampDuty)).toFixed(1)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#1C2734] font-bold text-sm">
                  <span className="text-[#43D9FF]">Total Statutory Cost:</span>
                  <span className="text-[#F5F7FA]">₹{totalTaxes}</span>
                </div>
              </div>
            </div>
          )}

          {/* 5. CAGR Calculator */}
          {activeTool === "cagr" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-6 space-y-4">
                <h3 className="text-xl font-bold font-display text-[#F5F7FA]">
                  Compound Annual Growth Rate (CAGR)
                </h3>
                <p className="text-xs text-[#9AA7B5] leading-relaxed">
                  Formula: <code className="text-[#43D9FF]">CAGR = (End Value / Begin Value)^(1/n) - 1</code>.
                </p>

                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Initial Capital (₹)</label>
                    <input
                      type="number"
                      value={initialInv}
                      onChange={(e) => setInitialInv(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] p-2 text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Final Capital (₹)</label>
                    <input
                      type="number"
                      value={finalInv}
                      onChange={(e) => setFinalInv(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#1C2734] bg-[#080D14] p-2 text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="text-[#9AA7B5] block mb-1">Duration: {years} Years</label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={years}
                      onChange={(e) => setYears(Number(e.target.value))}
                      className="w-full accent-[#43D9FF]"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-xl border border-[#1C2734] bg-[#080D14] p-6 text-center text-xs font-mono flex flex-col justify-center">
                <div className="text-xs text-[#9AA7B5]">ANNUALIZED GROWTH RATE</div>
                <div className="text-4xl font-bold font-mono text-[#22C55E] my-2">
                  {cagr}% CAGR
                </div>
                <div className="text-xs text-[#667383]">
                  Absolute Growth: {(((finalInv - initialInv) / (initialInv || 1)) * 100).toFixed(1)}% over {years} years
                </div>
              </div>
            </div>
          )}

          {/* 6. Portfolio Allocation Calculator */}
          {activeTool === "portfolio" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-6 space-y-4">
                <h3 className="text-xl font-bold font-display text-[#F5F7FA]">
                  Institutional Asset Allocation Blueprint
                </h3>
                <p className="text-xs text-[#9AA7B5] leading-relaxed">
                  Diversification model dividing corpus across Indian equities, sovereign debt, precious metals, and liquidity reserves.
                </p>

                <div className="flex gap-2 text-xs font-mono">
                  {(["conservative", "balanced", "dynamic"] as const).map((prof) => (
                    <button
                      key={prof}
                      onClick={() => setRiskProfile(prof)}
                      className={`px-3 py-2 rounded-lg capitalize transition-colors ${
                        riskProfile === prof
                          ? "bg-[#43D9FF] text-[#05070B] font-bold"
                          : "bg-[#111923] text-[#9AA7B5] border border-[#1C2734]"
                      }`}
                    >
                      {prof}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6 rounded-xl border border-[#1C2734] bg-[#080D14] p-6 text-xs font-mono space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#43D9FF]">Equity & Growth:</span>
                  <span className="font-bold text-[#F5F7FA]">{allocation.equity}%</span>
                </div>
                <div className="w-full bg-[#111923] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#43D9FF] h-full" style={{ width: `${allocation.equity}%` }} />
                </div>

                <div className="flex justify-between pt-2">
                  <span className="text-[#7C5CFF]">Debt & Fixed Income:</span>
                  <span className="font-bold text-[#F5F7FA]">{allocation.debt}%</span>
                </div>
                <div className="w-full bg-[#111923] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#7C5CFF] h-full" style={{ width: `${allocation.debt}%` }} />
                </div>

                <div className="flex justify-between pt-2">
                  <span className="text-[#F5B84B]">Gold & Commodities:</span>
                  <span className="font-bold text-[#F5F7FA]">{allocation.gold}%</span>
                </div>
                <div className="w-full bg-[#111923] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#F5B84B] h-full" style={{ width: `${allocation.gold}%` }} />
                </div>

                <div className="flex justify-between pt-2">
                  <span className="text-[#22C55E]">Cash & Liquid Reserves:</span>
                  <span className="font-bold text-[#F5F7FA]">{allocation.cash}%</span>
                </div>
                <div className="w-full bg-[#111923] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#22C55E] h-full" style={{ width: `${allocation.cash}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Bottom Transparency Notice */}
          <div className="mt-8 pt-4 border-t border-[#1C2734] flex items-center gap-2 text-[11px] font-mono text-[#667383]">
            <Info className="size-3.5 text-[#43D9FF] shrink-0" />
            <span>
              Disclaimer: Financial tools provide mathematical estimation based on user inputs. Calculators do not constitute financial advice, performance guarantees, or predictive certainty.
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
