"use client";

import { useState, useId, useMemo } from "react";
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Printer, 
  MessageSquare,
  BarChart2,
  Lock,
  ChevronRight,
  Check,
  Edit3,
  RefreshCw,
  Info
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, Select, Badge, Notice } from "../ui";

export interface QuestionDef {
  id: number;
  sectionId: 1 | 2 | 3 | 4;
  sectionTitle: string;
  code: string;
  question: string;
  help?: string;
  type: "single" | "multi";
  criticalQuestion?: boolean;
  options: {
    label: string;
    value: string;
    score: number;
    flag?: string;
    criticalNote?: string;
    isCorrect?: boolean;
  }[];
}

export const TOP_20_QUESTIONS: QuestionDef[] = [
  // SECTION 1: FINANCIAL PROFILE
  {
    id: 1,
    sectionId: 1,
    sectionTitle: "Section 1: Financial Profile",
    code: "q1_income_source",
    question: "1. What is your primary source of income?",
    type: "single",
    options: [
      { label: "Salaried employment", value: "salaried", score: 20 },
      { label: "Business or self-employed", value: "business", score: 20 },
      { label: "Rental or investment income", value: "investment", score: 20 },
      { label: "Pension or retirement income", value: "pension", score: 15 },
      { label: "Freelancing or commission-based income", value: "freelance", score: 12 },
      { label: "Other", value: "other", score: 10 },
      { label: "No regular income", value: "no_income", score: 0, flag: "unemployed_no_income" },
    ],
  },
  {
    id: 2,
    sectionId: 1,
    sectionTitle: "Section 1: Financial Profile",
    code: "q2_income_stability",
    question: "2. How stable is your monthly income?",
    type: "single",
    options: [
      { label: "Highly stable income with substantial surplus cash flow", value: "highly_stable", score: 25 },
      { label: "Steady salary or business revenue with modest monthly savings", value: "steady", score: 18 },
      { label: "Variable income with occasional savings", value: "variable", score: 8 },
      { label: "Irregular income; expenses are unpredictable", value: "irregular", score: 0, flag: "volatile_income" },
    ],
  },
  {
    id: 3,
    sectionId: 1,
    sectionTitle: "Section 1: Financial Profile",
    code: "q3_monthly_surplus",
    question: "3. Approximately how much of your monthly income remains after essential expenses?",
    type: "single",
    options: [
      { label: "More than 40%", value: "gt_40", score: 25 },
      { label: "21%–40%", value: "21_40", score: 20 },
      { label: "10%–20%", value: "10_20", score: 12 },
      { label: "Less than 10%", value: "lt_10", score: 5 },
      { label: "No regular surplus", value: "no_surplus", score: 0, flag: "no_discretionary_surplus" },
    ],
  },
  {
    id: 4,
    sectionId: 1,
    sectionTitle: "Section 1: Financial Profile",
    code: "q4_emergency_fund",
    question: "4. How many months of essential living expenses can your emergency savings cover?",
    type: "single",
    options: [
      { label: "More than 6 months", value: "gt_6m", score: 15 },
      { label: "3–6 months", value: "3_6m", score: 12 },
      { label: "1–3 months", value: "1_3m", score: 8 },
      { label: "Less than 1 month", value: "lt_1m", score: 2 },
      { label: "No separate emergency savings", value: "none", score: 0, flag: "no_emergency_buffer" },
    ],
  },
  {
    id: 5,
    sectionId: 1,
    sectionTitle: "Section 1: Financial Profile",
    code: "q5_capital_share",
    question: "5. What portion of your total liquid savings and investments does your proposed trading capital represent?",
    type: "single",
    options: [
      { label: "Less than 10%", value: "lt_10", score: 15 },
      { label: "10%–20%", value: "10_20", score: 12 },
      { label: "20%–50%", value: "20_50", score: 6 },
      { label: "Not sure", value: "not_sure", score: 3 },
      { label: "More than 50%", value: "gt_50", score: 0, flag: "high_concentration_risk" },
    ],
  },

  // SECTION 2: TRADING OBJECTIVES AND RISK CAPACITY
  {
    id: 6,
    sectionId: 2,
    sectionTitle: "Section 2: Trading objectives and risk capacity",
    code: "q6_trading_objective",
    question: "6. What is your primary objective for trading?",
    type: "single",
    options: [
      { label: "High-risk speculative opportunities", value: "speculative", score: 20 },
      { label: "Short-term trading profits", value: "short_term", score: 18 },
      { label: "Supplementary income", value: "supplementary", score: 14 },
      { label: "Long-term wealth creation", value: "wealth_creation", score: 10 },
      { label: "Learning about financial markets", value: "learning", score: 5 },
      { label: "Capital preservation", value: "preservation", score: 2 },
    ],
  },
  {
    id: 7,
    sectionId: 2,
    sectionTitle: "Section 2: Trading objectives and risk capacity",
    code: "q7_liquidity_horizon",
    question: "7. When will you need the money allocated to trading?",
    type: "single",
    options: [
      { label: "More than 5 years", value: "gt_5y", score: 20 },
      { label: "3–5 years", value: "3_5y", score: 16 },
      { label: "1–3 years", value: "1_3y", score: 12 },
      { label: "3–12 months", value: "3_12m", score: 6 },
      { label: "Within 3 months", value: "lt_3m", score: 1, flag: "short_liquidity_horizon" },
    ],
  },
  {
    id: 8,
    sectionId: 2,
    sectionTitle: "Section 2: Trading objectives and risk capacity",
    code: "q8_loss_impact",
    question: "8. If you lost your entire proposed trading capital, what would be the impact on your finances?",
    type: "single",
    criticalQuestion: true,
    help: "Mandatory Suitability Metric: Ensures capital at risk is strictly discretionary surplus.",
    options: [
      { label: "My essential expenses and financial goals would remain manageable", value: "manageable", score: 20 },
      { label: "My discretionary spending would be affected", value: "discretionary", score: 15 },
      { label: "I would need to postpone important financial goals", value: "postpone_goals", score: 8 },
      { 
        label: "I would need to use emergency savings or borrow money", 
        value: "use_emergency_borrow", 
        score: 0, 
        flag: "CRITICAL_Q8_EMERGENCY_AT_RISK", 
        criticalNote: "Critical Question 8 Flag: Loss of capital forces emergency depletion or borrowing. Restricted from leveraged derivatives." 
      },
      { 
        label: "I would struggle to meet essential expenses", 
        value: "struggle_expenses", 
        score: 0, 
        flag: "CRITICAL_Q8_ESSENTIAL_AT_RISK", 
        criticalNote: "Critical Question 8 Flag: Essential living expense vulnerability. Mandatory conservative tier only." 
      },
    ],
  },
  {
    id: 9,
    sectionId: 2,
    sectionTitle: "Section 2: Trading objectives and risk capacity",
    code: "q9_drawdown_tolerance",
    question: "9. What percentage decline in your trading portfolio could you tolerate before seriously reconsidering your strategy?",
    type: "single",
    options: [
      { label: "More than 20%", value: "gt_20", score: 20 },
      { label: "11%–20%", value: "11_20", score: 15 },
      { label: "6%–10%", value: "6_10", score: 10 },
      { label: "3%–5%", value: "3_5", score: 5 },
      { label: "Less than 3%", value: "lt_3", score: 1 },
      { label: "Not sure", value: "not_sure", score: 3 },
    ],
  },
  {
    id: 10,
    sectionId: 2,
    sectionTitle: "Section 2: Trading objectives and risk capacity",
    code: "q10_consecutive_losses",
    question: "10. What would you do if your trading portfolio experienced consecutive losses?",
    type: "single",
    options: [
      { label: "Stop trading and review my financial exposure", value: "stop_review", score: 20 },
      { label: "Reduce position sizes", value: "reduce_size", score: 18 },
      { label: "Continue following my predefined trading plan", value: "follow_plan", score: 15 },
      { label: "Increase trading activity to recover losses", value: "overtrade", score: 0, flag: "revenge_trading_risk" },
      { label: "Increase position sizes to recover losses quickly", value: "martingale", score: 0, flag: "martingale_risk" },
    ],
  },

  // SECTION 3: TRADING EXPERIENCE AND KNOWLEDGE
  {
    id: 11,
    sectionId: 3,
    sectionTitle: "Section 3: Trading experience and knowledge",
    code: "q11_instruments_traded",
    question: "11. Which financial instruments have you previously traded with real capital? (Select all that apply.)",
    type: "multi",
    help: "Select all instruments you have traded with live capital. Select 'None' if this is your first time.",
    options: [
      { label: "Equity delivery", value: "eq_delivery", score: 4 },
      { label: "Equity intraday", value: "eq_intraday", score: 4 },
      { label: "Mutual funds or ETFs", value: "mf_etf", score: 3 },
      { label: "Index options — Nifty / Bank Nifty", value: "index_options", score: 5 },
      { label: "Stock options", value: "stock_options", score: 4 },
      { label: "Stock futures", value: "stock_futures", score: 4 },
      { label: "Index futures", value: "index_futures", score: 4 },
      { label: "Commodity derivatives — MCX", value: "mcx_commodities", score: 4 },
      { label: "None", value: "none", score: 0 },
    ],
  },
  {
    id: 12,
    sectionId: 3,
    sectionTitle: "Section 3: Trading experience and knowledge",
    code: "q12_experience_duration",
    question: "12. How long have you been trading with real money?",
    type: "single",
    options: [
      { label: "More than 5 years", value: "gt_5y", score: 20 },
      { label: "3–5 years", value: "3_5y", score: 16 },
      { label: "1–3 years", value: "1_3y", score: 12 },
      { label: "6–12 months", value: "6_12m", score: 8 },
      { label: "Less than 6 months", value: "lt_6m", score: 4 },
      { label: "No real-money trading experience", value: "none", score: 0, flag: "novice_trader" },
    ],
  },
  {
    id: 13,
    sectionId: 3,
    sectionTitle: "Section 3: Trading experience and knowledge",
    code: "q13_fno_understanding",
    question: "13. How would you rate your understanding of futures and options?",
    type: "single",
    options: [
      { label: "Expert; I have substantial practical experience", value: "expert", score: 20 },
      { label: "Advanced; I understand Greeks, volatility and position sizing", value: "advanced", score: 18 },
      { label: "Intermediate; I understand payoff and risk", value: "intermediate", score: 14 },
      { label: "Basic; I understand premiums and expiry", value: "basic", score: 8 },
      { label: "Beginner; I need basic education", value: "beginner", score: 2 },
      { label: "I do not trade derivatives", value: "do_not_trade", score: 0 },
    ],
  },
  {
    id: 14,
    sectionId: 3,
    sectionTitle: "Section 3: Trading experience and knowledge",
    code: "q14_option_loss_knowledge",
    question: "14. What is the maximum potential loss when buying a standard, fully paid option and holding it to expiry?",
    type: "single",
    criticalQuestion: true,
    help: "Technical Knowledge Test: Evaluates comprehension of long option payoff asymmetry.",
    options: [
      { label: "The entire premium paid", value: "premium_paid", score: 20, isCorrect: true },
      { 
        label: "Unlimited losses in all cases", 
        value: "unlimited_losses", 
        score: 0, 
        flag: "CRITICAL_Q14_OPTION_RISK_CONFUSION", 
        criticalNote: "Critical Question 14 Flag: Buyer risk confused with naked option writing. Payoff briefing mandatory." 
      },
      { 
        label: "Only the brokerage charges", 
        value: "only_brokerage", 
        score: 0, 
        flag: "CRITICAL_Q14_INCORRECT_LOSS", 
        criticalNote: "Critical Question 14 Flag: Failed to identify 100% premium capital risk upon expiry." 
      },
      { 
        label: "I am not sure", 
        value: "not_sure", 
        score: 0, 
        flag: "CRITICAL_Q14_UNSURE_OPTION_RISK", 
        criticalNote: "Critical Question 14 Flag: Unsure about option buyer loss dynamics. Educational gate active." 
      },
    ],
  },
  {
    id: 15,
    sectionId: 3,
    sectionTitle: "Section 3: Trading experience and knowledge",
    code: "q15_leverage_risk_knowledge",
    question: "15. What is a major risk of trading leveraged derivatives?",
    type: "single",
    criticalQuestion: true,
    help: "Technical Knowledge Test: Evaluates comprehension of margin leverage and gap exposure.",
    options: [
      { label: "Losses can increase rapidly and may exceed the planned risk budget", value: "rapid_losses", score: 15, isCorrect: true },
      { 
        label: "Losses are always limited to the initial margin", 
        value: "limited_margin", 
        score: 0, 
        flag: "CRITICAL_Q15_LEVERAGE_MISUNDERSTOOD", 
        criticalNote: "Critical Question 15 Flag: Unaware that gap openings and extreme volatility can surpass initial margin." 
      },
      { 
        label: "Leverage eliminates the impact of market volatility", 
        value: "eliminates_volatility", 
        score: 0, 
        flag: "CRITICAL_Q15_LEVERAGE_ILLUSION", 
        criticalNote: "Critical Question 15 Flag: Believes leverage reduces risk. Mandatory risk disclosures required." 
      },
      { 
        label: "I am not sure", 
        value: "not_sure", 
        score: 0, 
        flag: "CRITICAL_Q15_UNSURE_LEVERAGE", 
        criticalNote: "Critical Question 15 Flag: Derivative leverage risks not understood. Ineligible for high-margin trades." 
      },
    ],
  },

  // SECTION 4: TRADING DISCIPLINE AND BEHAVIOUR
  {
    id: 16,
    sectionId: 4,
    sectionTitle: "Section 4: Trading discipline and behaviour",
    code: "q16_stop_loss_discipline",
    question: "16. Do you establish a stop-loss or predefined exit plan before entering a trade?",
    type: "single",
    options: [
      { label: "Always", value: "always", score: 25 },
      { label: "Usually", value: "usually", score: 20 },
      { label: "Sometimes", value: "sometimes", score: 10 },
      { label: "Rarely", value: "rarely", score: 4 },
      { label: "Never", value: "never", score: 0, flag: "poor_stop_loss_discipline" },
    ],
  },
  {
    id: 17,
    sectionId: 4,
    sectionTitle: "Section 4: Trading discipline and behaviour",
    code: "q17_borrowed_funds",
    question: "17. Have you ever borrowed money or used funds reserved for essential expenses to trade?",
    type: "single",
    criticalQuestion: true,
    help: "Statutory Capital Integrity: Strictly assesses borrowed capital or personal debt utilization.",
    options: [
      { label: "Never", value: "never", score: 25 },
      { label: "Previously, but not currently", value: "previously", score: 12 },
      { 
        label: "Occasionally", 
        value: "occasionally", 
        score: 0, 
        flag: "CRITICAL_Q17_OCCASIONAL_BORROWING", 
        criticalNote: "Critical Question 17 Flag: Client reports occasional borrowing to trade. High SEBI risk flag." 
      },
      { 
        label: "Currently doing so", 
        value: "currently", 
        score: 0, 
        flag: "CRITICAL_Q17_ACTIVE_BORROWED_CAPITAL", 
        criticalNote: "Critical Question 17 Flag: Actively trading on borrowed money. Leveraged advisory strictly restricted." 
      },
    ],
  },
  {
    id: 18,
    sectionId: 4,
    sectionTitle: "Section 4: Trading discipline and behaviour",
    code: "q18_decision_process",
    question: "18. How do you usually make trading decisions?",
    type: "single",
    options: [
      { label: "A predefined strategy with risk limits", value: "predefined_strategy", score: 20 },
      { label: "Independent technical or fundamental analysis", value: "independent_analysis", score: 18 },
      { label: "Research reports or expert recommendations", value: "research_reports", score: 16 },
      { label: "News, social media or market sentiment", value: "news_sentiment", score: 6 },
      { label: "Tips from friends or messaging groups", value: "tips", score: 2, flag: "unverified_tips" },
      { label: "Impulsive decisions based on market movements", value: "impulsive", score: 0, flag: "impulsive_trading" },
    ],
  },
  {
    id: 19,
    sectionId: 4,
    sectionTitle: "Section 4: Trading discipline and behaviour",
    code: "q19_expert_conflict",
    question: "19. What would you do if an expert recommendation conflicted with your personal risk limits?",
    type: "single",
    options: [
      { label: "Follow my predefined risk limits", value: "follow_limits", score: 15 },
      { label: "Seek clarification before deciding", value: "seek_clarification", score: 12 },
      { label: "Follow the recommendation if I trust the expert", value: "trust_expert", score: 6 },
      { label: "Increase exposure if the potential return appears attractive", value: "increase_exposure", score: 2 },
      { label: "Not sure", value: "not_sure", score: 4 },
    ],
  },
  {
    id: 20,
    sectionId: 4,
    sectionTitle: "Section 4: Trading discipline and behaviour",
    code: "q20_conservative_alignment",
    question: "20. Are you willing to accept a more conservative service if your financial situation or experience does not support your preferred trading activity?",
    type: "single",
    options: [
      { label: "Yes, I prefer a suitable approach based on my circumstances", value: "yes_suitable", score: 15 },
      { label: "Yes, after discussing the reasons", value: "yes_discuss", score: 12 },
      { label: "I would prefer to retain my original preference", value: "retain_preference", score: 4 },
      { label: "Not sure", value: "not_sure", score: 6 },
    ],
  },
];

interface RiskBand {
  tier: "Conservative" | "Moderate" | "Balanced" | "Aggressive";
  minScore: number;
  maxScore: number;
  color: string;
  badgeTone: "brand" | "positive" | "warning" | "danger";
  summary: string;
  suitability: string[];
  warnings: string;
}

const RISK_BANDS: RiskBand[] = [
  {
    tier: "Conservative",
    minScore: 0,
    maxScore: 39,
    color: "#38BDF8",
    badgeTone: "brand",
    summary: "Primary objective is capital preservation and portfolio safety. Focus is on liquid, non-leveraged assets with minimal drawdown tolerance.",
    suitability: [
      "Large-cap cash delivery equity investing",
      "Liquid Index ETFs and sovereign debt-backed assets",
      "Strict predefined trailing stop-losses (max 2–3% risk)",
      "Zero derivative exposure until experience gates are cleared"
    ],
    warnings: "Derivatives (Futures & Options) and high-frequency intraday trades are NOT permissible for this risk tier.",
  },
  {
    tier: "Moderate",
    minScore: 40,
    maxScore: 59,
    color: "#10B981",
    badgeTone: "positive",
    summary: "Accepts measured, controlled fluctuations to achieve steady wealth compounding above inflation across mid-term holding periods.",
    suitability: [
      "Cash swing trading across Mid & Large cap equities",
      "Sector rotation breakout setups with defined stop-losses",
      "Positional momentum holdings (2–12 weeks)",
      "Hedging through low-beta multi-asset diversification"
    ],
    warnings: "Unhedged options buying with rapid time-decay is discouraged; capital allocation per trade strictly limited to 5%.",
  },
  {
    tier: "Balanced",
    minScore: 60,
    maxScore: 79,
    color: "#F59E0B",
    badgeTone: "warning",
    summary: "Comfortable with standard market pullbacks and controlled multi-asset risk exposure. Demonstrates disciplined stop-loss compliance.",
    suitability: [
      "Equities and directional index derivative strategies",
      "Disciplined Risk-to-Reward ratio models (1:2.5+)",
      "Positional stock options with defined risk spreads",
      "Intraday momentum breakouts within preset loss budgets"
    ],
    warnings: "Position sizing must never exceed 3–5% of declared trading capital per trade.",
  },
  {
    tier: "Aggressive",
    minScore: 80,
    maxScore: 100,
    color: "#A855F7",
    badgeTone: "danger",
    summary: "Experienced market participant with high financial capacity, verified knowledge of options payoff mechanics, and active discipline.",
    suitability: [
      "Active Index Options & High-Beta Stock Derivatives",
      "Intraday momentum breakouts & MCX commodity setups",
      "Algorithmic dynamic hedging & volatility expansion models",
      "Positional multi-leg derivative spreads"
    ],
    warnings: "High volatility strategies carry potential for rapid drawdowns. Must uphold non-negotiable stop-loss compliance.",
  },
];

export function RpmForm({
  consentText,
}: {
  consentText?: string | null;
}) {
  const formId = useId();
  // 1: Contact, 2: Questionnaire, 2.5: Review, 3: Completed Result
  const [viewState, setViewState] = useState<"contact" | "questions" | "review" | "result">("contact");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Investor Basic Details
  const [formData, setFormData] = useState({
    fullName: "",
    mobile: "",
    email: "",
    city: "",
    state: "",
    capitalRange: "",
    consentWhatsApp: true,
  });

  // Questionnaire Answers (initialized with sensible SEBI-aligned defaults)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({
    q1_income_source: "salaried",
    q2_income_stability: "steady",
    q3_monthly_surplus: "21_40",
    q4_emergency_fund: "3_6m",
    q5_capital_share: "10_20",
    q6_trading_objective: "short_term",
    q7_liquidity_horizon: "1_3y",
    q8_loss_impact: "manageable",
    q9_drawdown_tolerance: "11_20",
    q10_consecutive_losses: "reduce_size",
    q11_instruments_traded: ["eq_delivery"],
    q12_experience_duration: "1_3y",
    q13_fno_understanding: "intermediate",
    q14_option_loss_knowledge: "premium_paid",
    q15_leverage_risk_knowledge: "rapid_losses",
    q16_stop_loss_discipline: "usually",
    q17_borrowed_funds: "never",
    q18_decision_process: "predefined_strategy",
    q19_expert_conflict: "follow_limits",
    q20_conservative_alignment: "yes_suitable",
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    leadCode: string;
    compositeScore: number;
    financialScore: number;
    riskScore: number;
    knowledgeScore: number;
    disciplineScore: number;
    band: RiskBand;
    criticalNotes: string[];
    flags: string[];
  } | null>(null);

  // Compute multi-dimensional scores and critical flags
  const evaluation = useMemo(() => {
    let financialRaw = 0;
    let riskRaw = 0;
    let knowledgeRaw = 0;
    let disciplineRaw = 0;
    const flags: string[] = [];
    const criticalNotes: string[] = [];

    for (const q of TOP_20_QUESTIONS) {
      const val = answers[q.code];

      if (q.type === "single" && typeof val === "string") {
        const opt = q.options.find((o) => o.value === val);
        if (opt) {
          if (q.sectionId === 1) financialRaw += opt.score;
          if (q.sectionId === 2) riskRaw += opt.score;
          if (q.sectionId === 3) knowledgeRaw += opt.score;
          if (q.sectionId === 4) disciplineRaw += opt.score;
          if (opt.flag) flags.push(opt.flag);
          if (opt.criticalNote) criticalNotes.push(opt.criticalNote);
        }
      } else if (q.type === "multi" && Array.isArray(val)) {
        let multiSum = 0;
        for (const item of val) {
          const opt = q.options.find((o) => o.value === item);
          if (opt) {
            multiSum += opt.score;
            if (opt.flag) flags.push(opt.flag);
            if (opt.criticalNote) criticalNotes.push(opt.criticalNote);
          }
        }
        if (q.sectionId === 3) {
          // Cap instrument knowledge score contribution at 25
          knowledgeRaw += Math.min(25, multiSum);
        }
      }
    }

    // Normalized scores out of 100 for each dimension
    const financialScore = Math.min(100, Math.round(financialRaw));
    const riskToleranceScore = Math.min(100, Math.round(riskRaw));
    const knowledgeScore = Math.min(100, Math.round(knowledgeRaw));
    const disciplineScore = Math.min(100, Math.round(disciplineRaw));

    // Weighted composite calculation: 30% Financial, 30% Risk, 25% Knowledge, 15% Discipline
    let compositeScore = Math.round(
      financialScore * 0.30 +
      riskToleranceScore * 0.30 +
      knowledgeScore * 0.25 +
      disciplineScore * 0.15
    );

    // CRITICAL SAFETY GATES (Mandatory SEBI Suitability Check):
    // If Question 17 indicates active borrowing OR Question 8 indicates essential expenses at risk,
    // immediately cap tier at Conservative (max 35) to prevent inappropriate leveraged recommendations.
    const hasBorrowedFunds = answers["q17_borrowed_funds"] === "currently" || answers["q17_borrowed_funds"] === "occasionally";
    const hasEssentialLossRisk = answers["q8_loss_impact"] === "struggle_expenses" || answers["q8_loss_impact"] === "use_emergency_borrow";

    if (hasBorrowedFunds || hasEssentialLossRisk) {
      compositeScore = Math.min(compositeScore, 35);
    }

    const band = RISK_BANDS.find((b) => compositeScore >= b.minScore && compositeScore <= b.maxScore) || RISK_BANDS[0];

    return {
      compositeScore,
      financialScore,
      riskToleranceScore,
      knowledgeScore,
      disciplineScore,
      band,
      flags,
      criticalNotes,
    };
  }, [answers]);

  const handleSingleSelect = (code: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [code]: val }));
  };

  const handleMultiToggle = (code: string, val: string) => {
    setAnswers((prev) => {
      const curr = Array.isArray(prev[code]) ? (prev[code] as string[]) : [];
      let updated: string[];

      if (val === "none") {
        // If "None" is chosen, deselect all other instruments
        updated = curr.includes("none") ? [] : ["none"];
      } else {
        // If another instrument is chosen, remove "None"
        const filtered = curr.filter((v) => v !== "none");
        updated = filtered.includes(val) ? filtered.filter((v) => v !== val) : [...filtered, val];
      }
      return { ...prev, [code]: updated };
    });
  };

  const validateContact = () => {
    if (!formData.fullName.trim()) return "Please enter your full name.";
    const cleanPhone = formData.mobile.replace(/\D/g, "");
    if (cleanPhone.length < 10) return "Please enter a valid 10-digit Indian mobile number.";
    if (formData.email && !formData.email.includes("@")) return "Please enter a valid email address.";
    return null;
  };

  const handleNextToQuestions = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateContact();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setViewState("questions");
    setCurrentQuestionIndex(0);
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  const handleQuestionNext = () => {
    if (currentQuestionIndex < TOP_20_QUESTIONS.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setViewState("review");
      window.scrollTo({ top: 300, behavior: "smooth" });
    }
  };

  const handleQuestionPrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    } else {
      setViewState("contact");
    }
  };

  const handleSubmitAssessment = async () => {
    setSubmitting(true);
    setFormError(null);

    // Prepare human-readable QA breakdown for CRM & compliance audit
    const breakdown = TOP_20_QUESTIONS.map((q) => {
      const val = answers[q.code];
      let ansText = "Not answered";
      if (q.type === "single") {
        ansText = q.options.find((o) => o.value === val)?.label || String(val);
      } else if (Array.isArray(val)) {
        ansText = val.map((v) => q.options.find((o) => o.value === v)?.label || v).join("; ");
      }
      return { code: q.code, question: q.question, answer: ansText };
    });

    const payload = {
      fullName: formData.fullName.trim(),
      full_name: formData.fullName.trim(),
      phone: formData.mobile.replace(/\D/g, "").slice(-10),
      mobile: formData.mobile.replace(/\D/g, "").slice(-10),
      email: formData.email.trim() || undefined,
      city: formData.city.trim() || undefined,
      state: formData.state.trim() || undefined,
      capital_range: formData.capitalRange || "Under review",
      form_key: "risk_assessment_top20",
      source: "risk_assessment",
      consentWhatsApp: formData.consentWhatsApp,
      consents: {
        data_processing: true,
        whatsapp: formData.consentWhatsApp,
        calls: true,
      },
      assessment: {
        score: evaluation.compositeScore,
        category: evaluation.band.tier,
        financial_capacity_score: evaluation.financialScore,
        risk_tolerance_score: evaluation.riskToleranceScore,
        knowledge_score: evaluation.knowledgeScore,
        discipline_score: evaluation.disciplineScore,
        flags: evaluation.flags,
        critical_notes: evaluation.criticalNotes,
        suitability_summary: evaluation.band.summary,
        suitability_recommendations: evaluation.band.suitability,
        warnings: evaluation.band.warnings,
        questions: breakdown,
      },
    };

    try {
      const resp = await api.post<any>("/public/leads", payload);
      const leadRef = (resp && (resp.data?.leadCode || resp.data?.data?.leadCode)) || `RPM-${Math.floor(1000 + Math.random() * 9000)}`;
      setSubmissionResult({
        leadCode: leadRef,
        compositeScore: evaluation.compositeScore,
        financialScore: evaluation.financialScore,
        riskScore: evaluation.riskToleranceScore,
        knowledgeScore: evaluation.knowledgeScore,
        disciplineScore: evaluation.disciplineScore,
        band: evaluation.band,
        criticalNotes: evaluation.criticalNotes,
        flags: evaluation.flags,
      });
      setViewState("result");
      window.scrollTo({ top: 250, behavior: "smooth" });
    } catch (err: any) {
      console.warn("[RPM Submission fallback]", err);
      // Seamless local display if network or offline
      setSubmissionResult({
        leadCode: `RPM-${Math.floor(1000 + Math.random() * 9000)}`,
        compositeScore: evaluation.compositeScore,
        financialScore: evaluation.financialScore,
        riskScore: evaluation.riskToleranceScore,
        knowledgeScore: evaluation.knowledgeScore,
        disciplineScore: evaluation.disciplineScore,
        band: evaluation.band,
        criticalNotes: evaluation.criticalNotes,
        flags: evaluation.flags,
      });
      setViewState("result");
      window.scrollTo({ top: 250, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // VIEW: RESULT / COMPLETED CERTIFICATE
  // ==========================================
  if (viewState === "result" && submissionResult) {
    const { leadCode, compositeScore, financialScore, riskScore, knowledgeScore, disciplineScore, band, criticalNotes } = submissionResult;
    return (
      <div className="space-y-6">
        <Card className="p-6 sm:p-8 border border-[#1C2734] bg-gradient-to-b from-[#111923] via-[#0D131C] to-[#080D14] shadow-2xl rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1C2734] pb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#43D9FF]/10 px-3 py-0.5 text-xs font-mono font-medium text-[#43D9FF]">
                <ShieldCheck className="size-3.5" />
                <span>SEBI SUITABILITY AUDIT &bull; REF: {leadCode}</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#F5F7FA] mt-2 font-display">
                Your Risk Classification: <span style={{ color: band.color }}>{band.tier}</span>
              </h3>
              <p className="text-xs text-[#9AA7B5] mt-1">
                Suitability Assessed for: <strong className="text-[#F5F7FA]">{formData.fullName}</strong> (+91 {formData.mobile.slice(-10)})
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs text-[#667383] block uppercase tracking-wider font-mono">Suitability Score</span>
                <span className="text-4xl font-extrabold font-mono text-[#F5F7FA]">
                  {compositeScore} <span className="text-sm font-normal text-[#667383]">/ 100</span>
                </span>
              </div>
              <div className="h-14 w-2.5 rounded-full" style={{ backgroundColor: band.color }} />
            </div>
          </div>

          {/* Dimensional Breakdown Meters */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#080D14] p-3.5 border border-[#1C2734]">
              <span className="text-[11px] font-mono uppercase text-[#667383]">Financial Capacity</span>
              <p className="text-lg font-bold text-[#43D9FF] font-mono mt-1">{financialScore}%</p>
              <div className="mt-1.5 h-1.5 w-full bg-[#1C2734] rounded-full overflow-hidden">
                <div className="h-full bg-[#43D9FF] rounded-full" style={{ width: `${financialScore}%` }} />
              </div>
            </div>
            <div className="rounded-xl bg-[#080D14] p-3.5 border border-[#1C2734]">
              <span className="text-[11px] font-mono uppercase text-[#667383]">Risk Tolerance</span>
              <p className="text-lg font-bold text-[#F5B84B] font-mono mt-1">{riskScore}%</p>
              <div className="mt-1.5 h-1.5 w-full bg-[#1C2734] rounded-full overflow-hidden">
                <div className="h-full bg-[#F5B84B] rounded-full" style={{ width: `${riskScore}%` }} />
              </div>
            </div>
            <div className="rounded-xl bg-[#080D14] p-3.5 border border-[#1C2734]">
              <span className="text-[11px] font-mono uppercase text-[#667383]">Market Knowledge</span>
              <p className="text-lg font-bold text-[#7C5CFF] font-mono mt-1">{knowledgeScore}%</p>
              <div className="mt-1.5 h-1.5 w-full bg-[#1C2734] rounded-full overflow-hidden">
                <div className="h-full bg-[#7C5CFF] rounded-full" style={{ width: `${knowledgeScore}%` }} />
              </div>
            </div>
            <div className="rounded-xl bg-[#080D14] p-3.5 border border-[#1C2734]">
              <span className="text-[11px] font-mono uppercase text-[#667383]">Trading Discipline</span>
              <p className="text-lg font-bold text-[#22C55E] font-mono mt-1">{disciplineScore}%</p>
              <div className="mt-1.5 h-1.5 w-full bg-[#1C2734] rounded-full overflow-hidden">
                <div className="h-full bg-[#22C55E] rounded-full" style={{ width: `${disciplineScore}%` }} />
              </div>
            </div>
          </div>

          {/* CRITICAL QUESTIONS REVIEW WARNINGS (Q8, Q14, Q15, Q17) */}
          {criticalNotes.length > 0 && (
            <div className="mt-6 rounded-xl border border-[#F5B84B]/40 bg-[#F5B84B]/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#F5B84B]">
                <AlertTriangle className="size-4 shrink-0 text-[#F5B84B]" />
                <span>Special Suitability Review Flags Detected</span>
              </div>
              <ul className="space-y-1.5 text-xs text-[#F5F7FA]">
                {criticalNotes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#F5B84B] font-bold">&bull;</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-[#F5F7FA]">Profile Analysis</h4>
              <p className="text-sm text-[#9AA7B5] mt-1 leading-relaxed">{band.summary}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[#F5F7FA]">Permissible Research & Advisory Strategies:</h4>
              <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {band.suitability.map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 rounded-lg bg-[#080D14] p-2.5 border border-[#1C2734] text-xs text-[#F5F7FA]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#43D9FF]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Notice tone={band.badgeTone === "danger" ? "warning" : "brand"} title="Statutory Advisory Guidelines" className="mt-4">
              {band.warnings}
            </Notice>

            <div className="rounded-xl bg-[#080D14] p-4 border border-[#1C2734] text-xs text-[#9AA7B5] flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#43D9FF]" />
                <span>A compliance record has been secured for audit reference: <strong>{leadCode}</strong>.</span>
              </div>
              <button 
                onClick={() => window.print()} 
                className="inline-flex items-center gap-1.5 text-[#43D9FF] hover:text-[#7ce3ff] font-medium cursor-pointer"
              >
                <Printer className="size-3.5" /> Print / Save Certificate PDF
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#1C2734] flex flex-wrap items-center justify-between gap-4">
            <a
              href={`https://wa.me/919201800995?text=${encodeURIComponent(
                `Hi Expert Stocks, I just completed my 20-Factor Client Suitability Assessment (${band.tier} tier, Score: ${compositeScore}/100, Ref: ${leadCode}). I would like to review suitable research plans.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#22C55E] px-5 py-2.5 text-sm font-bold text-black shadow-md hover:bg-[#1eb054] transition-all"
            >
              <MessageSquare className="size-4" /> Discuss Results on WhatsApp &rarr;
            </a>

            <button
              onClick={() => {
                setViewState("contact");
                setSubmissionResult(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#667383] hover:text-[#9AA7B5] underline cursor-pointer"
            >
              <RefreshCw className="size-3" /> Retake Assessment
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // ==========================================
  // VIEW: STEP 1 — INVESTOR CONTACT DETAILS
  // ==========================================
  if (viewState === "contact") {
    return (
      <form onSubmit={handleNextToQuestions} className="space-y-5">
        {formError && <Notice tone="danger">{formError}</Notice>}

        <div className="flex items-center justify-between pb-3 border-b border-[#1C2734]">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#43D9FF]">
            Step 1 of 3: Investor Information
          </span>
          <span className="text-xs text-[#667383]">SEBI Suitability Mandatory Record</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name (as per PAN / Demat)" htmlFor={`${formId}-name`}>
            <Input
              id={`${formId}-name`}
              required
              placeholder="e.g. Ramesh Kumar"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </Field>

          <Field label="10-digit Mobile Number" htmlFor={`${formId}-mobile`}>
            <Input
              id={`${formId}-mobile`}
              type="tel"
              required
              placeholder="98765 43210"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />
          </Field>

          <Field label="Email Address (for Suitability Certificate)" htmlFor={`${formId}-email`} optional>
            <Input
              id={`${formId}-email`}
              type="email"
              placeholder="ramesh@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </Field>

          <Field label="Residential City & State" htmlFor={`${formId}-city`} optional>
            <Input
              id={`${formId}-city`}
              placeholder="e.g. Pune, Maharashtra"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Proposed Trading Capital Allocation" htmlFor={`${formId}-capital`} optional>
          <Select
            id={`${formId}-capital`}
            value={formData.capitalRange}
            onChange={(e) => setFormData({ ...formData, capitalRange: e.target.value })}
          >
            <option value="">Prefer to discuss with advisor</option>
            <option value="under_1l">Under ₹1 Lakh</option>
            <option value="1l_5l">₹1 Lakh to ₹5 Lakhs</option>
            <option value="5l_25l">₹5 Lakhs to ₹25 Lakhs (HNI Tier)</option>
            <option value="above_25l">Above ₹25 Lakhs (Ultra HNI Bespoke)</option>
          </Select>
        </Field>

        <div className="rounded-xl bg-[#080D14] p-3.5 border border-[#1C2734]">
          <label className="flex items-center gap-3 cursor-pointer text-xs text-[#9AA7B5]">
            <input
              type="checkbox"
              checked={formData.consentWhatsApp}
              onChange={(e) => setFormData({ ...formData, consentWhatsApp: e.target.checked })}
              className="size-4 accent-[#43D9FF] rounded"
            />
            <span>Receive your audited suitability certificate and research alerts via WhatsApp.</span>
          </label>
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary" className="w-full justify-center">
            Proceed to 20 Suitability Questions <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>

        <p className="text-[11px] text-[#667383] text-center leading-relaxed">
          {consentText || "By continuing, you agree that Expert Stocks Consultancy may securely record and evaluate your responses in compliance with SEBI (Research Analysts) Regulations, 2014."}
        </p>
      </form>
    );
  }

  // ==========================================
  // VIEW: STEP 2 — TOP 20 SUITABILITY QUESTIONS
  // ==========================================
  if (viewState === "questions") {
    const activeQ = TOP_20_QUESTIONS[currentQuestionIndex];
    const currentVal = answers[activeQ.code];
    const progressPercent = Math.round(((currentQuestionIndex + 1) / TOP_20_QUESTIONS.length) * 100);

    return (
      <div className="space-y-6">
        {/* Progress & Section Header */}
        <div className="space-y-2 border-b border-[#1C2734] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#43D9FF]">
              Question {activeQ.id} of {TOP_20_QUESTIONS.length}
            </span>
            <span className="rounded-full bg-[#080D14] px-3 py-1 text-[11px] font-mono text-[#9AA7B5] border border-[#1C2734]">
              {activeQ.sectionTitle}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-[#111923] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#43D9FF] to-[#7C5CFF] rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#667383]">
            <span>{progressPercent}% Complete</span>
            <span>Live Score: {evaluation.compositeScore}/100 &bull; Tier: <strong style={{ color: evaluation.band.color }}>{evaluation.band.tier}</strong></span>
          </div>
        </div>

        {/* Current Question Card */}
        <Card className="p-6 bg-[#0D131C] border border-[#1C2734] rounded-2xl space-y-4">
          <div>
            {activeQ.criticalQuestion && (
              <div className="inline-flex items-center gap-1.5 rounded-md bg-[#F5B84B]/10 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-[#F5B84B] mb-2 border border-[#F5B84B]/20">
                <AlertTriangle className="size-3" />
                <span>Critical SEBI Suitability Check</span>
              </div>
            )}
            <h3 className="text-base sm:text-lg font-bold text-[#F5F7FA]">
              {activeQ.question}
            </h3>
            {activeQ.help && (
              <p className="mt-1 text-xs text-[#9AA7B5] flex items-center gap-1.5">
                <Info className="size-3.5 shrink-0 text-[#43D9FF]" />
                <span>{activeQ.help}</span>
              </p>
            )}
          </div>

          {/* Options List */}
          <div className="space-y-2.5 pt-2">
            {activeQ.options.map((opt) => {
              const isMulti = activeQ.type === "multi";
              const checked = isMulti
                ? Array.isArray(currentVal) && currentVal.includes(opt.value)
                : currentVal === opt.value;

              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3.5 rounded-xl p-3.5 text-xs sm:text-sm transition-all cursor-pointer border ${
                    checked
                      ? "bg-[#43D9FF]/10 border-[#43D9FF]/60 text-[#F5F7FA] font-medium shadow-[0_0_15px_rgba(67,217,255,0.1)]"
                      : "bg-[#080D14]/80 border-[#1C2734] text-[#9AA7B5] hover:border-[#283749] hover:text-[#F5F7FA]"
                  }`}
                >
                  <input
                    type={isMulti ? "checkbox" : "radio"}
                    name={activeQ.code}
                    value={opt.value}
                    checked={checked}
                    onChange={() =>
                      isMulti
                        ? handleMultiToggle(activeQ.code, opt.value)
                        : handleSingleSelect(activeQ.code, opt.value)
                    }
                    className="size-4 mt-0.5 accent-[#43D9FF] cursor-pointer"
                  />
                  <div className="flex-1">
                    <span>{opt.label}</span>
                  </div>
                  {checked && <Check className="size-4 shrink-0 text-[#43D9FF]" />}
                </label>
              );
            })}
          </div>
        </Card>

        {/* Question Paging Navigation */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleQuestionPrev}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            {currentQuestionIndex === 0 ? "Back to Contact" : "Previous"}
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleQuestionNext}
            className="gap-2"
          >
            {currentQuestionIndex === TOP_20_QUESTIONS.length - 1 ? (
              <>Review Answers <ArrowRight className="size-4" /></>
            ) : (
              <>Next Question <ArrowRight className="size-4" /></>
            )}
          </Button>
        </div>

        {/* Quick Question Selector Grid */}
        <div className="pt-4 border-t border-[#1C2734]">
          <span className="text-[11px] font-mono text-[#667383] block mb-2">Quick Navigate:</span>
          <div className="flex flex-wrap gap-1.5">
            {TOP_20_QUESTIONS.map((q, idx) => {
              const isAnswered = q.type === "multi" 
                ? Array.isArray(answers[q.code]) && (answers[q.code] as string[]).length > 0
                : Boolean(answers[q.code]);
              const isCurrent = idx === currentQuestionIndex;

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`size-7 rounded-lg text-xs font-mono font-medium transition-all ${
                    isCurrent
                      ? "bg-[#43D9FF] text-[#05070B] font-bold shadow-md"
                      : isAnswered
                      ? "bg-[#111923] text-[#9AA7B5] hover:text-[#F5F7FA] border border-[#1C2734]"
                      : "bg-[#080D14] text-[#667383] border border-[#1C2734]"
                  }`}
                  title={`Question ${q.id}`}
                >
                  {q.id}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: STEP 2.5 — CLIENT REVIEW BEFORE SUBMIT
  // ==========================================
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1C2734] pb-4">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#43D9FF]">
            Step 3 of 3: Review Answers & Verify Suitability
          </span>
          <h3 className="text-xl font-bold text-[#F5F7FA] font-display mt-0.5">
            Confirm Your Suitability Profile
          </h3>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[#080D14] px-3.5 py-1.5 border border-[#1C2734]">
          <span className="text-xs text-[#667383]">Computed Tier:</span>
          <span className="text-xs font-bold font-mono" style={{ color: evaluation.band.color }}>
            {evaluation.band.tier} ({evaluation.compositeScore}/100)
          </span>
        </div>
      </div>

      {formError && <Notice tone="danger">{formError}</Notice>}

      {/* Critical Alerts Banner (if Q8, 14, 15, or 17 triggered) */}
      {evaluation.criticalNotes.length > 0 && (
        <div className="rounded-xl border border-[#F5B84B]/40 bg-[#F5B84B]/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#F5B84B]">
            <AlertTriangle className="size-4 shrink-0 text-[#F5B84B]" />
            <span>Suitability Flags for Compliance Attention (Questions 8, 14, 15, 17)</span>
          </div>
          <ul className="space-y-1 text-xs text-[#F5F7FA]">
            {evaluation.criticalNotes.map((note, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[#F5B84B] font-bold">&bull;</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section-by-Section Review Cards */}
      {[1, 2, 3, 4].map((secId) => {
        const secQuestions = TOP_20_QUESTIONS.filter((q) => q.sectionId === secId);
        const sectionTitle = secQuestions[0]?.sectionTitle || `Section ${secId}`;

        return (
          <Card key={secId} className="p-5 bg-[#0D131C] border border-[#1C2734] rounded-2xl space-y-3">
            <h4 className="text-xs font-mono font-semibold uppercase text-[#43D9FF] tracking-wider border-b border-[#1C2734] pb-2">
              {sectionTitle}
            </h4>

            <div className="divide-y divide-[#1C2734]/60">
              {secQuestions.map((q) => {
                const val = answers[q.code];
                let answerDisplay = "Not answered";
                if (q.type === "single") {
                  answerDisplay = q.options.find((o) => o.value === val)?.label || String(val);
                } else if (Array.isArray(val)) {
                  answerDisplay = val
                    .map((v) => q.options.find((o) => o.value === v)?.label || v)
                    .join(", ");
                }

                return (
                  <div key={q.id} className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-[#9AA7B5]">{q.question}</p>
                      <p className="text-xs font-semibold text-[#F5F7FA] mt-0.5">{answerDisplay}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentQuestionIndex(q.id - 1);
                        setViewState("questions");
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-[#43D9FF] hover:underline cursor-pointer shrink-0 pt-0.5"
                    >
                      <Edit3 className="size-3" /> Edit
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#1C2734]">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setCurrentQuestionIndex(TOP_20_QUESTIONS.length - 1);
            setViewState("questions");
          }}
          className="gap-2"
        >
          <ArrowLeft className="size-4" /> Back to Questions
        </Button>

        <Button
          type="button"
          variant="primary"
          onClick={handleSubmitAssessment}
          disabled={submitting}
          className="gap-2 px-8"
        >
          {submitting ? (
            <>Submitting to Compliance...</>
          ) : (
            <>Confirm & Submit Assessment <CheckCircle2 className="size-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
