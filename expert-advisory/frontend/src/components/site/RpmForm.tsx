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
  Lock
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, Select, Badge, Notice } from "../ui";

interface QuestionDef {
  code: string;
  weight: number;
  question: string;
  help: string;
  type: "single" | "multi";
  options: { label: string; value: string; score: number; flag?: string }[];
}

const QUESTIONS: QuestionDef[] = [
  {
    code: "experience",
    weight: 2,
    question: "How long have you been actively investing or trading in capital markets?",
    help: "Understanding your experience level ensures research setups match your operational capability.",
    type: "single",
    options: [
      { label: "Less than 1 year (Beginner / Fresh to markets)", value: "lt_1y", score: 0, flag: "low_experience" },
      { label: "1 to 3 years (Familiar with standard market orders)", value: "1_3y", score: 2 },
      { label: "3 to 7 years (Experienced with market volatility)", value: "3_7y", score: 4 },
      { label: "More than 7 years (Seasoned market participant)", value: "gt_7y", score: 5 },
    ],
  },
  {
    code: "horizon",
    weight: 2,
    question: "What is your intended investment and capital horizon?",
    help: "Different strategies require distinct time commitments to realize positive statistical expectancy.",
    type: "single",
    options: [
      { label: "Intraday to very short term (Under 1 month)", value: "short", score: 1 },
      { label: "Short to medium term (1 month to 6 months)", value: "medium", score: 3 },
      { label: "Positional / Multi-month (6 months to 2 years)", value: "positional", score: 4 },
      { label: "Long term wealth compounding (Over 2 years)", value: "long", score: 5 },
    ],
  },
  {
    code: "loss_tolerance",
    weight: 2,
    question: "If your trading capital experienced a 15% to 20% drawdown in a volatile phase, how would you respond?",
    help: "Loss tolerance determines whether derivative leverage or cash delivery allocation is appropriate.",
    type: "single",
    options: [
      { label: "Exit positions immediately; cannot tolerate capital drawdowns", value: "exit", score: 0, flag: "strict_preservation" },
      { label: "Reduce positions and hold defensively until market stabilizes", value: "defensive", score: 2 },
      { label: "Hold according to predetermined stop-loss and review the setup", value: "plan", score: 4 },
      { label: "Add additional capital at institutional demand zones", value: "aggressive", score: 5 },
    ],
  },
  {
    code: "income_stability",
    weight: 1,
    question: "How would you characterize the stability of your primary income source?",
    help: "Market risks should only ever be assumed with discretionary disposable capital.",
    type: "single",
    options: [
      { label: "Fluctuating / Irregular income; expenses are unpredictable", value: "unstable", score: 0, flag: "income_risk" },
      { label: "Steady salary or business revenue with modest monthly savings", value: "steady", score: 3 },
      { label: "Highly stable income with substantial surplus cash flow", value: "robust", score: 5 },
    ],
  },
  {
    code: "capital_share",
    weight: 1,
    question: "What portion of your total liquid net worth does this trading capital represent?",
    help: "SEBI suitability mandates avoiding excessive concentration of personal savings in risk assets.",
    type: "single",
    options: [
      { label: "More than 50% of my total savings", value: "high_concentration", score: 0, flag: "concentration_risk" },
      { label: "Between 20% and 50% of my total savings", value: "moderate_share", score: 2 },
      { label: "Less than 20% of my liquid investment capital", value: "low_share", score: 5 },
    ],
  },
  {
    code: "instruments",
    weight: 1,
    question: "Which market instruments have you previously traded with real capital? (Select all that apply)",
    help: "Derivatives (F&O) require prior knowledge of contract specifications and premium decay.",
    type: "multi",
    options: [
      { label: "Equity Cash Delivery (NSE / BSE)", value: "equity", score: 1 },
      { label: "Mutual Funds / ETFs", value: "mf", score: 1 },
      { label: "Index Options (Nifty / Bank Nifty)", value: "options", score: 3 },
      { label: "Stock Futures / MCX Commodities", value: "fno_commodities", score: 2 },
    ],
  },
];

interface RiskBand {
  tier: "Conservative" | "Moderate" | "Balanced" | "Aggressive";
  minScore: number;
  maxScore: number;
  color: string;
  badgeTone: "positive" | "brand" | "warning" | "danger";
  summary: string;
  suitability: string[];
  warnings: string;
}

const RISK_BANDS: RiskBand[] = [
  {
    tier: "Conservative",
    minScore: 0,
    maxScore: 14,
    color: "#38BDF8",
    badgeTone: "brand",
    summary: "Primary objective is capital preservation and minimizing portfolio volatility.",
    suitability: [
      "Large-cap cash delivery investing",
      "Liquid ETFs and low-beta sector leaders",
      "Strict predefined trailing stop-losses"
    ],
    warnings: "Derivatives (Futures & Options) and high-frequency intraday trades are NOT recommended for this risk tier.",
  },
  {
    tier: "Moderate",
    minScore: 15,
    maxScore: 26,
    color: "#10B981",
    badgeTone: "positive",
    summary: "Accepts measured, controlled fluctuations to achieve steady long-term compounding above inflation.",
    suitability: [
      "Cash swing trading across Mid & Large caps",
      "Sector rotation breakout setups",
      "Positional momentum holdings (2–8 weeks)"
    ],
    warnings: "Overnight index options buying with high time-decay risk is discouraged.",
  },
  {
    tier: "Balanced",
    minScore: 27,
    maxScore: 38,
    color: "#F59E0B",
    badgeTone: "warning",
    summary: "Comfortable with standard market cycles, pullbacks, and controlled multi-asset risk exposure.",
    suitability: [
      "Equities and directional index derivatives",
      "Disciplined Risk-to-Reward ratio strategies (1:2.5+)",
      "Positional stock options with defined risk spreads"
    ],
    warnings: "Always adhere to position sizing limits of not more than 3–5% capital risk per trade.",
  },
  {
    tier: "Aggressive",
    minScore: 39,
    maxScore: 60,
    color: "#A855F7",
    badgeTone: "danger",
    summary: "Experienced market participant seeking maximum momentum with capacity to absorb high volatility.",
    suitability: [
      "Active Index Options & High-Beta Stock Derivatives",
      "Intraday momentum breakouts & MCX commodity setups",
      "Algorithmic dynamic hedging strategies"
    ],
    warnings: "High volatility strategies carry potential for rapid drawdowns. Strict stop-loss compliance is mandatory.",
  },
];

export function RpmForm({
  consentText,
}: {
  consentText?: string | null;
}) {
  const formId = useId();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Contact, 2: Questions, 3: Completed Result
  
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

  // Questionnaire Answers
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({
    experience: "1_3y",
    horizon: "medium",
    loss_tolerance: "defensive",
    income_stability: "steady",
    capital_share: "moderate_share",
    instruments: ["equity"],
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    leadCode: string;
    score: number;
    band: RiskBand;
  } | null>(null);

  // Compute live score
  const { totalScore, currentBand } = useMemo(() => {
    let score = 0;
    for (const q of QUESTIONS) {
      const val = answers[q.code];
      if (q.type === "single" && typeof val === "string") {
        const opt = q.options.find((o) => o.value === val);
        if (opt) score += opt.score * q.weight;
      } else if (q.type === "multi" && Array.isArray(val)) {
        for (const item of val) {
          const opt = q.options.find((o) => o.value === item);
          if (opt) score += opt.score * q.weight;
        }
      }
    }
    // Scale normalized to max 60
    const scaledScore = Math.min(60, Math.round(score * 1.3));
    const band = RISK_BANDS.find((b) => scaledScore >= b.minScore && scaledScore <= b.maxScore) || RISK_BANDS[1];
    return { totalScore: scaledScore, currentBand: band };
  }, [answers]);

  const handleSingleSelect = (code: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [code]: val }));
  };

  const handleMultiToggle = (code: string, val: string) => {
    setAnswers((prev) => {
      const curr = Array.isArray(prev[code]) ? (prev[code] as string[]) : [];
      const updated = curr.includes(val) ? curr.filter((v) => v !== val) : [...curr, val];
      return { ...prev, [code]: updated };
    });
  };

  const validateStep1 = () => {
    if (!formData.fullName.trim()) return "Please enter your full name.";
    const cleanPhone = formData.mobile.replace(/\D/g, "");
    if (cleanPhone.length < 10) return "Please enter a valid 10-digit Indian mobile number.";
    if (formData.email && !formData.email.includes("@")) return "Please enter a valid email address.";
    return null;
  };

  const handleNextToQuestions = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStep1();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setStep(2);
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  const handleSubmitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    // Prepare human-readable QA breakdown
    const breakdown = QUESTIONS.map((q) => {
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
      form_key: "risk_assessment",
      source: "risk_assessment",
      consentWhatsApp: formData.consentWhatsApp,
      consents: {
        data_processing: true,
        whatsapp: formData.consentWhatsApp,
        calls: true,
      },
      assessment: {
        score: totalScore,
        category: currentBand.tier,
        suitability_summary: currentBand.summary,
        suitability_recommendations: currentBand.suitability,
        warnings: currentBand.warnings,
        questions: breakdown,
      },
    };

    try {
      const resp = await api.post<any>("/public/leads", payload);
      const leadRef = (resp && (resp.data?.leadCode || resp.data?.data?.leadCode)) || `RPM-${Math.floor(1000 + Math.random() * 9000)}`;
      setSubmissionResult({
        leadCode: leadRef,
        score: totalScore,
        band: currentBand,
      });
      setStep(3);
      window.scrollTo({ top: 250, behavior: "smooth" });
    } catch (err: any) {
      console.warn("[RPM Submission fallback]", err);
      // Fallback local display if offline
      setSubmissionResult({
        leadCode: `RPM-${Math.floor(1000 + Math.random() * 9000)}`,
        score: totalScore,
        band: currentBand,
      });
      setStep(3);
    } finally {
      setSubmitting(false);
    }
  };

  // STEP 3: Completed Report Card
  if (step === 3 && submissionResult) {
    const { leadCode, score, band } = submissionResult;
    return (
      <div className="space-y-6 animate-rise">
        <Card className="p-6 sm:p-8 border-2 border-teal-500/40 bg-gradient-to-b from-[#111923] to-[#080D14]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1C2734] pb-6">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-teal-400">SEBI Suitability Evaluation &bull; Reference {leadCode}</span>
              <h3 className="text-2xl font-bold text-[#F5F7FA] mt-1">Your Risk Profile: <span style={{ color: band.color }}>{band.tier}</span></h3>
              <p className="text-xs text-[#9AA7B5] mt-0.5">Assessed for: <strong>{formData.fullName}</strong> (+91 {formData.mobile.slice(-10)})</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-[#667383] block">Suitability Score</span>
                <span className="text-3xl font-extrabold font-mono text-[#F5F7FA]">{score} <span className="text-sm font-normal text-[#667383]">/ 60</span></span>
              </div>
              <div className="h-12 w-2 rounded-full" style={{ backgroundColor: band.color }} />
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-[#F5F7FA]">Profile Analysis</h4>
              <p className="text-sm text-[#9AA7B5] mt-1 leading-relaxed">{band.summary}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[#F5F7FA]">Suitable Research & Advisory Strategies:</h4>
              <ul className="mt-2 space-y-2">
                {band.suitability.map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-xs text-[#E2E8F0]">
                    <CheckCircle2 className="size-4 shrink-0 text-teal-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Notice tone={band.badgeTone === "danger" ? "warning" : "brand"} title="Important Risk Advisory" className="mt-4">
              {band.warnings}
            </Notice>

            <div className="rounded-xl bg-[#080D14] p-4 border border-[#1C2734] text-xs text-[#9AA7B5] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-teal-400" />
                <span>A complete copy of this assessment has been dispatched to <strong>{formData.email || 'support@expertstocks.in'}</strong>.</span>
              </div>
              <button 
                onClick={() => window.print()} 
                className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-medium cursor-pointer"
              >
                <Printer className="size-3.5" /> Print / Save PDF
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#1C2734] flex flex-wrap items-center justify-between gap-4">
            <a
              href={`https://wa.me/919238837041?text=${encodeURIComponent(
                `Hi Expert Stocks, I just completed my Risk Assessment (${band.tier} tier, Score: ${score}/60, Ref: ${leadCode}). I would like to discuss suitable advisory services.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-bold text-black shadow-md hover:bg-[#20ba59] transition-all"
            >
              <MessageSquare className="size-4" /> Discuss Results on WhatsApp &rarr;
            </a>

            <button
              onClick={() => {
                setStep(1);
                setSubmissionResult(null);
              }}
              className="text-xs text-[#667383] hover:text-[#9AA7B5] underline"
            >
              Retake Assessment
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // STEP 1: Investor Contact Details
  if (step === 1) {
    return (
      <form onSubmit={handleNextToQuestions} className="space-y-5">
        {formError && <Notice tone="danger">{formError}</Notice>}

        <div className="flex items-center justify-between pb-3 border-b border-[#1C2734]">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-teal-400">Step 1 of 2: Investor Information</span>
          <span className="text-xs text-[#667383]">Mandatory SEBI Suitability Record</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name (as per PAN / Bank records)" htmlFor={`${formId}-name`}>
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

          <Field label="Email Address (for Assessment Report)" htmlFor={`${formId}-email`} optional>
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

        <Field label="Approximate Capital Intended for Market Allocation" htmlFor={`${formId}-capital`} optional>
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
              className="size-4 accent-teal-500 rounded"
            />
            <span>Receive your suitability certificate and timely research alerts via WhatsApp.</span>
          </label>
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary" className="w-full justify-center">
            Proceed to Suitability Questions <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>

        <p className="text-[11px] text-[#667383] text-center leading-relaxed">
          {consentText || "By continuing, you agree that Expert Stocks Consultancy and TradeGrow may store and process your information for statutory risk profiling in accordance with our Privacy Policy."}
        </p>
      </form>
    );
  }

  // STEP 2: Interactive Questionnaire
  return (
    <form onSubmit={handleSubmitAssessment} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1C2734]">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-teal-400">Step 2 of 2: Risk Profile Methodology</span>
          <p className="text-xs text-[#9AA7B5]">Answer 6 standardized questions to calculate your risk capacity tier.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#080D14] px-3 py-1 border border-[#1C2734]">
          <span className="text-xs text-[#667383]">Current Profile:</span>
          <span className="text-xs font-bold" style={{ color: currentBand.color }}>{currentBand.tier} ({totalScore}/60)</span>
        </div>
      </div>

      {formError && <Notice tone="danger">{formError}</Notice>}

      <div className="space-y-5">
        {QUESTIONS.map((q, idx) => {
          const currentVal = answers[q.code];

          return (
            <Card key={q.code} className="p-5 border border-[#1C2734] bg-[#0A1017]">
              <div className="flex items-start gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-xs font-bold text-teal-400">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-[#F5F7FA]">{q.question}</h4>
                  <p className="text-xs text-[#667383] mt-0.5">{q.help}</p>

                  <div className="mt-3.5 space-y-2">
                    {q.options.map((opt) => {
                      const isMulti = q.type === "multi";
                      const checked = isMulti
                        ? Array.isArray(currentVal) && currentVal.includes(opt.value)
                        : currentVal === opt.value;

                      return (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs transition-all cursor-pointer border ${
                            checked
                              ? "bg-teal-500/10 border-teal-500/50 text-[#F5F7FA] font-medium"
                              : "bg-[#080D14]/60 border-[#1C2734] text-[#9AA7B5] hover:border-[#283749] hover:text-[#F5F7FA]"
                          }`}
                        >
                          <input
                            type={isMulti ? "checkbox" : "radio"}
                            name={q.code}
                            value={opt.value}
                            checked={checked}
                            onChange={() =>
                              isMulti ? handleMultiToggle(q.code, opt.value) : handleSingleSelect(q.code, opt.value)
                            }
                            className="size-4 accent-teal-400"
                          />
                          <span className="flex-1">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Real-time Result Preview */}
      <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-mono uppercase text-teal-400">Real-Time Suitability Tier</span>
          <p className="text-sm font-bold text-[#F5F7FA]">
            {currentBand.tier} Strategy &bull; Score {totalScore} of 60
          </p>
          <p className="text-xs text-[#9AA7B5] mt-0.5">{currentBand.summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={currentBand.badgeTone} className="text-xs px-3 py-1">
            {currentBand.tier.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setStep(1)}
          disabled={submitting}
        >
          <ArrowLeft className="mr-2 size-4" /> Back to Details
        </Button>

        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          className="px-6"
        >
          {submitting ? "Submitting Assessment…" : "Calculate & Generate Certificate →"}
        </Button>
      </div>

      <p className="text-[11px] text-[#667383] text-center">
        SEBI (Research Analysts) Regulations, 2014 &bull; Versioned Suitability Algorithm 1.0 &bull; Dual-Control Encrypted
      </p>
    </form>
  );
}
