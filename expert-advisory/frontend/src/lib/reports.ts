export interface ResearchReport {
  id: string;
  category:
    | "Pre-market report"
    | "Post-market report"
    | "Stock research"
    | "Sector report"
    | "Technical report"
    | "Fundamental report"
    | "Options market report"
    | "Weekly & monthly reports"
    | "Educational reports"
    | "Risk alerts";
  title: string;
  summary: string;
  publishedAt: string;
  author: string;
  complianceId: string;
  timeframe: string;
  sentiment: "Bullish" | "Bearish" | "Neutral" | "High Alert";
  readTime: string;
  tags: string[];
  metrics: Array<{ label: string; value: string }>;
  content: {
    executiveSummary: string;
    keyObservations: string[];
    technicalLevels?: {
      pivot: string;
      resistance1: string;
      resistance2: string;
      support1: string;
      support2: string;
      maxPain?: string;
    };
    actionableTakeaway: string;
    riskDisclaimer: string;
  };
}

export function getDailyPublishedReports(): ResearchReport[] {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return [
    {
      id: "pre-market-today",
      category: "Pre-market report",
      title: `Morning Bell Briefing: Global Cues, GIFT Nifty & Key Opening Pivots`,
      summary:
        "Comprehensive morning pre-market analysis covering Asian opening trends, overnight Wall Street action, crude volatility, and critical opening support/resistance zones for Nifty 50 and Bank Nifty.",
      publishedAt: `${dateStr} · 08:30 AM IST`,
      author: "Quantitative Research Desk",
      complianceId: `EXP-PRE-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`,
      timeframe: "Intraday to 1-Day",
      sentiment: "Neutral",
      readTime: "3 min read",
      tags: ["GIFT Nifty", "Global Cues", "Opening Pivots", "Intraday Range"],
      metrics: [
        { label: "GIFT Nifty Implied Open", value: "22,460 (+35 pts)" },
        { label: "Nifty 50 Pivot", value: "22,415" },
        { label: "Bank Nifty Pivot", value: "54,420" },
        { label: "Opening Bias", value: "Mild Positive" },
      ],
      content: {
        executiveSummary:
          "Domestic indices are set to open on a stable footing following steady cues from Asian peers and overnight stabilization across US tech benchmarks. Focus remains on institutional reaction around the 22,400 pivot zone.",
        keyObservations: [
          "Asian indices trading mixed with Hang Seng finding support near major 20-DMA structural band.",
          "Crude oil prices consolidating below $72/bbl, providing macro tailwind to domestic refining and paint sectors.",
          "FII positioning indicates mild short-covering in index futures ahead of the weekly derivative expiry cycle.",
        ],
        technicalLevels: {
          pivot: "22,415",
          resistance1: "22,485",
          resistance2: "22,560",
          support1: "22,340",
          support2: "22,250",
          maxPain: "22,400",
        },
        actionableTakeaway:
          "Avoid aggressive long entries near opening gap; look for 15-minute price stabilization above 22,440 before deploying tactical intraday longs.",
        riskDisclaimer:
          "Market participants must maintain strict stop losses. Pre-market levels are indicative and derived from opening auctions and global cross-market correlations.",
      },
    },
    {
      id: "post-market-today",
      category: "Post-market report",
      title: `Daily Closing Wrap: Institutional Flow Analysis & Derivative Unwinding`,
      summary:
        "End-of-day market autopsy analyzing FII/DII provisional numbers, sector performance dynamics, IT resilience vs Auto profit booking, and positional carryover strategy.",
      publishedAt: `${dateStr} · 04:00 PM IST`,
      author: "Institutional Strategy Desk",
      complianceId: `EXP-POST-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`,
      timeframe: "Next Session Horizon",
      sentiment: "Neutral",
      readTime: "4 min read",
      tags: ["FII/DII Flows", "Closing Bell", "Sector Rotation", "Volume Leaders"],
      metrics: [
        { label: "FII Provisional Flow", value: "-₹482 Cr (Net Seller)" },
        { label: "DII Provisional Flow", value: "+₹1,145 Cr (Net Buyer)" },
        { label: "Top Sector", value: "NIFTY IT (+2.17%)" },
        { label: "Lagging Sector", value: "NIFTY AUTO (-3.46%)" },
      ],
      content: {
        executiveSummary:
          "The session concluded with clear sectoral divergence. Nifty IT outperformed on dollar earnings resilience, while Auto witnessed systematic profit booking following consecutive multi-week rallies.",
        keyObservations: [
          "Domestic Institutional Investors (DIIs) provided strong absorption around the 22,350 support base.",
          "Cash turnover on NSE stood at ₹84,200 Cr, slightly above the 10-day moving average.",
          "Breadth closed marginally balanced at 27 advances vs 23 declines within the Nifty 50 universe.",
        ],
        technicalLevels: {
          pivot: "22,420",
          resistance1: "22,500",
          resistance2: "22,610",
          support1: "22,320",
          support2: "22,210",
        },
        actionableTakeaway:
          "Hold quality defensive balance. Rotate capital from overextended cyclical auto names into selective large-cap IT and private banking leaders.",
        riskDisclaimer:
          "End-of-day data is verified against exchange closing figures. Past performance is no guarantee of future returns.",
      },
    },
    {
      id: "options-market-today",
      category: "Options market report",
      title: `Derivative Compass: Open Interest (OI) Concentration & PCR Breakdown`,
      summary:
        "Comprehensive derivative analytics tracking strike-by-strike Call/Put open interest buildup, Max Pain strike, Put-Call Ratio (PCR), and volatility smile skew.",
      publishedAt: `${dateStr} · 02:30 PM IST`,
      author: "Derivatives Analytics Group",
      complianceId: `EXP-OPT-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`,
      timeframe: "Weekly Expiry Horizon",
      sentiment: "Bullish",
      readTime: "4 min read",
      tags: ["Options OI", "PCR", "Max Pain", "Volatility Skew", "Straddle Premium"],
      metrics: [
        { label: "Nifty PCR (OI)", value: "1.08 (Bullish Bias)" },
        { label: "Max Pain Strike", value: "22,450" },
        { label: "Major Put Wall", value: "22,300 (8.4M OI)" },
        { label: "Major Call Resistance", value: "22,600 (9.1M OI)" },
      ],
      content: {
        executiveSummary:
          "Options chain structure reveals steady put writing across 22,300 and 22,400 strikes. Call writing remains capped at 22,600, suggesting a defined trading band between 22,300 and 22,550 for the ongoing expiry series.",
        keyObservations: [
          "Heavy put addition at 22,350 strike indicates firm institutional floor for the ongoing week.",
          "India VIX hovering at 14.46 keeps option straddle pricing within predictable statistical parameters.",
          "Bank Nifty PCR stands at 0.94, suggesting mild consolidation before the next directional expansion.",
        ],
        technicalLevels: {
          pivot: "22,430",
          resistance1: "22,550",
          resistance2: "22,620",
          support1: "22,320",
          support2: "22,250",
          maxPain: "22,450",
        },
        actionableTakeaway:
          "Options sellers can explore defined bull-put credit spreads with 22,250 / 22,150 legs, capturing theta decay while capping tail risk.",
        riskDisclaimer:
          "Derivatives trading involves high leverage and substantial capital risk. Strict margin adequacy must be maintained.",
      },
    },
    {
      id: "stock-research-today",
      category: "Stock research",
      title: `High-Conviction Stock Note: Quality Growth & Structural Breakout Candidates`,
      summary:
        "Quantitative fundamental screening identifying top balance sheet strength, earnings acceleration, and deterministic algorithmic trend confirmation.",
      publishedAt: `${dateStr} · 11:15 AM IST`,
      author: "Equity Research Cell",
      complianceId: `EXP-EQ-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`,
      timeframe: "1 to 3 Months",
      sentiment: "Bullish",
      readTime: "5 min read",
      tags: ["HDFC Bank", "Infosys", "Large Cap Growth", "Valuation Re-rating"],
      metrics: [
        { label: "Primary Coverage", value: "Large-Cap Banking / IT" },
        { label: "Target Upside", value: "+14.5% to +18.2%" },
        { label: "Structural Stop", value: "4.8% from CMP" },
        { label: "Quality Score", value: "9.2 / 10" },
      ],
      content: {
        executiveSummary:
          "Our multi-factor quantitative model highlights large-cap banking and tier-1 IT names trading at attractive valuation discounts relative to historical 5-year averages, backed by clean asset quality and expanding operating leverage.",
        keyObservations: [
          "Credit growth remains robust at 13.5% YoY with gross NPAs at multi-year cyclical lows across tier-1 banks.",
          "Tier-1 IT companies showing sequential improvement in deal Total Contract Value (TCV), signaling recovery in client discretionary spending.",
          "Free cash flow generation exceeds 90% of operating EBITDA across selected research universe.",
        ],
        actionableTakeaway:
          "Accumulate core positions on staggered dips within identified valuation bands. Maintain disciplined position sizing of 4-6% max portfolio allocation per single equity.",
        riskDisclaimer:
          "Research provided is for institutional information and analytical evaluation. No guaranteed returns are offered.",
      },
    },
    {
      id: "sector-report-today",
      category: "Sector report",
      title: `Sector Rotation Compass: Capital Goods, Banking & IT Margin Outlook`,
      summary:
        "Relative strength matrix analyzing sectoral money flows, order book visibility, raw material cost pressures, and earnings growth projections across major indices.",
      publishedAt: `${dateStr} · 01:00 PM IST`,
      author: "Macro & Sectoral Research",
      complianceId: `EXP-SEC-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`,
      timeframe: "Quarterly Outlook",
      sentiment: "Bullish",
      readTime: "5 min read",
      tags: ["Sector Radar", "IT Momentum", "Capex Cycle", "Auto Margin Trends"],
      metrics: [
        { label: "Leading Sector", value: "Technology (IT)" },
        { label: "Consolidating Sector", value: "Private Banking" },
        { label: "Overweight Rating", value: "Capital Goods & Defense" },
        { label: "Neutral Rating", value: "Consumer Staples" },
      ],
      content: {
        executiveSummary:
          "Capital allocation data indicates ongoing rotation toward technology and industrial infrastructure, while consumer discretionaries face short-term margin compression from input cost inflation.",
        keyObservations: [
          "Government infrastructure capex disbursement continuing at brisk pace, supporting order book execution.",
          "Software exporters benefit from stabilizing cross-currency tailwinds and ongoing digital transformation mandates.",
          "Auto OEM inventories elevated ahead of festive replenishment, prompting localized tactical corrections.",
        ],
        actionableTakeaway:
          "Overweight industrial manufacturing and engineering infrastructure. Maintain neutral allocation on consumer durables.",
        riskDisclaimer:
          "Sector cycles are subject to policy shifts and raw material price volatility. Diversification across non-correlated sectors is mandatory.",
      },
    },
    {
      id: "technical-report-today",
      category: "Technical report",
      title: `Technical Desk: Multi-Timeframe Candlestick Alignment & VWAP Profiling`,
      summary:
        "In-depth price action review tracking 20, 50, and 200 EMAs, High-Volume Node (HVN) distributions, and RSI momentum divergences across key benchmarks.",
      publishedAt: `${dateStr} · 10:45 AM IST`,
      author: "Quantitative Technical Desk",
      complianceId: `EXP-TECH-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`,
      timeframe: "Multi-Session",
      sentiment: "Bullish",
      readTime: "4 min read",
      tags: ["VWAP Profiling", "EMA Stack", "RSI Divergence", "Fibonacci Retracement"],
      metrics: [
        { label: "Nifty 200 EMA", value: "21,680 (Long-term Bullish)" },
        { label: "Nifty 50 EMA", value: "22,190 (Support Band)" },
        { label: "RSI (14-period)", value: "58.4 (Neutral Bullish)" },
        { label: "ATR (Average True Range)", value: "148 pts" },
      ],
      content: {
        executiveSummary:
          "Price action on daily timeframes maintains higher-high, higher-low structural integrity above the key 50-day exponential moving average. No bearish distribution patterns are evident on institutional volume footprints.",
        keyObservations: [
          "Volume Weighted Average Price (VWAP) anchored to the recent swing low shows persistent buyer accumulation.",
          "Momentum oscillators indicate constructive consolidation rather than exhausted blow-off tops.",
          "Bank Nifty testing upper Bollinger band with narrowing squeeze, indicating imminent volatility expansion.",
        ],
        actionableTakeaway:
          "Continue playing structural dip-buying strategies with trailing stop losses pegged to previous swing lows.",
        riskDisclaimer:
          "Technical levels reflect probabilistic historical patterns and may fail during unforeseen macroeconomic events.",
      },
    },
    {
      id: "fundamental-report-today",
      category: "Fundamental report",
      title: `Valuation Matrix: Balance Sheet Solvency & Free Cash Flow Yields`,
      summary:
        "Fundamental scorecard evaluating Debt/Equity ratios, Return on Capital Employed (ROCE), enterprise valuations, and corporate governance standards.",
      publishedAt: `${dateStr} · 09:30 AM IST`,
      author: "Fundamental Valuation Group",
      complianceId: `EXP-FND-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`,
      timeframe: "6 to 12 Months",
      sentiment: "Bullish",
      readTime: "6 min read",
      tags: ["FCF Yield", "ROCE Screen", "Solvency Ratios", "Earnings Quality"],
      metrics: [
        { label: "Median Universe ROCE", value: "18.6%" },
        { label: "Average Debt/Equity", value: "0.42x" },
        { label: "P/E Median (Nifty)", value: "22.4x" },
        { label: "Earnings Growth Est.", value: "14.2% YoY" },
      ],
      content: {
        executiveSummary:
          "Aggregate corporate profitability across India Inc. remains resilient. Low corporate leverage levels provide defensive buffers against higher-for-longer global sovereign yields.",
        keyObservations: [
          "Private sector capex is picking up in energy transition, chemicals, and industrial automation.",
          "Cash conversion cycles improved across manufacturing leaders by an average of 4 days.",
          "Operating margins stabilized as freight costs normalized and raw material contracts were renegotiated.",
        ],
        actionableTakeaway:
          "Focus core long-term capital on businesses possessing compounding ROCE exceeding 18% and net debt-to-operating cash flow under 1.5x.",
        riskDisclaimer:
          "Valuation estimates are built on consensus forward projections and audited company filings. Actual outcomes may differ.",
      },
    },
    {
      id: "weekly-monthly-today",
      category: "Weekly & monthly reports",
      title: `Macro Compass: RBI Interest Rate Trajectory & Global Capital Flows`,
      summary:
        "Macroeconomic strategic analysis detailing inflation dynamics, RBI Monetary Policy Committee stance, fiscal deficit trends, and currency reserves.",
      publishedAt: `${dateStr} · 09:00 AM IST`,
      author: "Chief Economist Desk",
      complianceId: `EXP-MAC-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`,
      timeframe: "Monthly / Quarterly",
      sentiment: "Neutral",
      readTime: "7 min read",
      tags: ["RBI Policy", "Inflation CPI", "Bond Yields", "Currency FX"],
      metrics: [
        { label: "RBI Repo Rate", value: "6.50% (Status Quo)" },
        { label: "India 10Y Yield", value: "6.98%" },
        { label: "CPI Headline Inflation", value: "4.85%" },
        { label: "FX Reserves", value: "$688 Billion (Record High)" },
      ],
      content: {
        executiveSummary:
          "India's macroeconomic foundations remain among the strongest across major emerging economies. Robust forex reserves provide currency stability against global dollar fluctuations.",
        keyObservations: [
          "Monetary policy stance expected to remain calibrated with liquidity conditions neutral to mildly surplus.",
          "Tax collections and GST run-rates track comfortably ahead of central budget estimates.",
          "Foreign portfolio investments exhibit steady institutional appetite despite global geopolitical crosscurrents.",
        ],
        actionableTakeaway:
          "Maintain balanced asset allocation with high-quality equities as primary wealth generator and debt allocation for liquidity cushions.",
        riskDisclaimer:
          "Macroeconomic analysis is intended for strategic asset planning and institutional context.",
      },
    },
    {
      id: "educational-report-today",
      category: "Educational reports",
      title: `Quantitative Handbook: Mathematical Risk-to-Reward & Capital Preservation`,
      summary:
        "Essential institutional curriculum covering position sizing formulas, Kelly criterion principles, drawdowns mitigation, and emotional trading psychology.",
      publishedAt: `${dateStr} · 08:00 AM IST`,
      author: "Investor Education & Risk Cell",
      complianceId: `EXP-EDU-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`,
      timeframe: "Perpetual Learning",
      sentiment: "Neutral",
      readTime: "8 min read",
      tags: ["Risk Management", "Position Sizing", "Kelly Criterion", "Drawdown Math"],
      metrics: [
        { label: "Optimal Risk Per Trade", value: "1.0% to 2.0% of Capital" },
        { label: "Target R:R Ratio", value: "1 : 2.5 Minimum" },
        { label: "Max Portfolio Heat", value: "6.0% Cumulative Risk" },
        { label: "Survival Probability", value: "99.4% with Strict Stop" },
      ],
      content: {
        executiveSummary:
          "Long-term profitability in financial markets is a mathematical consequence of risk asymmetry and disciplined position sizing, not predictive clairvoyance.",
        keyObservations: [
          "Even a trading system with a 45% win-rate generates compounding returns if average win-to-loss exceeds 2.5 to 1.",
          "A 20% drawdown requires a 25% gain to recover; a 50% drawdown requires a 100% gain. Preventing deep drawdowns is job #1.",
          "Never increase position size after consecutive losses; reduce size until baseline emotional equilibrium is restored.",
        ],
        actionableTakeaway:
          "Implement deterministic position sizing: determine the monetary stop loss first, then calculate lot size based on fixed 1% portfolio risk.",
        riskDisclaimer:
          "Educational material is provided strictly for knowledge development and investor protection awareness.",
      },
    },
    {
      id: "risk-alert-today",
      category: "Risk alerts",
      title: `Risk Advisory: Volatility Regime Spike & Event Risk Protocols`,
      summary:
        "Special compliance warning alerting investors to implied volatility expansions, key central bank announcements, and protective hedging protocols.",
      publishedAt: `${dateStr} · 07:30 AM IST`,
      author: "Chief Risk Officer Desk",
      complianceId: `EXP-RSK-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`,
      timeframe: "Immediate Advisory",
      sentiment: "High Alert",
      readTime: "2 min read",
      tags: ["Volatility Spike", "Hedging Protocols", "Event Risk", "Capital Safety"],
      metrics: [
        { label: "Alert Severity", value: "Elevated Prudence" },
        { label: "Event Focus", value: "Global Macro Data & Options Expiry" },
        { label: "Leverage Advisory", value: "Curtail Intraday Margin by 30%" },
        { label: "Protective Hedge", value: "Out-of-Money Put Spreads" },
      ],
      content: {
        executiveSummary:
          "With India VIX experiencing short-term intraday spikes, retail and institutional participants are advised to reduce gross overnight leverage and ensure all open derivative positions carry hard catastrophic stop-loss orders.",
        keyObservations: [
          "Option premiums are subject to sharp post-event volatility crushes.",
          "Do not carry unhedged short options positions into overnight sessions.",
          "Ensure stop-loss orders are pre-registered on exchange order books rather than tracked manually in memory.",
        ],
        actionableTakeaway:
          "Tighten stop-loss levels on profitable momentum positions. Ensure no single trade poses risk exceeding predefined daily risk budgets.",
        riskDisclaimer:
          "Risk alerts are issued under institutional risk management guidelines to safeguard capital against non-linear market dislocations.",
      },
    },
  ];
}
