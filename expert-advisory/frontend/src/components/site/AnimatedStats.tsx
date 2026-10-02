"use client";

import { Award, Clock, Database, ShieldAlert, ShieldCheck } from "lucide-react";

const STATS = [
  {
    icon: Database,
    value: "100%",
    label: "Deterministic Calculations",
    detail: "Mathematical technical and fundamental metrics computed via tested, immutable code — zero hallucinations.",
    tone: "text-brand-600",
    bg: "bg-brand-50",
  },
  {
    icon: Clock,
    value: "24-48 Hrs",
    label: "Prompt Grievance SLA",
    detail: "Guaranteed prompt turnaround for any investor inquiry or grievance filed, handled by our dedicated compliance cell.",
    tone: "text-teal-600",
    bg: "bg-teal-50",
  },
  {
    icon: ShieldAlert,
    value: "0%",
    label: "Return Promises or Profit Sharing",
    detail: "Strict compliance with SEBI advertisement codes. We never promise assured profits or loss-protection schemes.",
    tone: "text-rose-600",
    bg: "bg-rose-50",
  },
  {
    icon: ShieldCheck,
    value: "5 Years",
    label: "Immutable Audit Archive",
    detail: "Every published research report, recommendation, and investor communication is cryptographically preserved for 5 years.",
    tone: "text-indigo-600",
    bg: "bg-indigo-50",
  },
];

export function AnimatedStats() {
  return (
    <section className="relative overflow-hidden border-y border-ink-200/80 bg-gradient-to-b from-ink-950 to-ink-900 py-16 text-white sm:py-20">
      {/* Decorative ambient gradients */}
      <div className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-brand-600/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 size-72 rounded-full bg-teal-500/20 blur-3xl" aria-hidden="true" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-semibold text-brand-300 ring-1 ring-white/20">
            <Award className="size-3.5" />
            Institutional Compliance Standard
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Built from day one on regulatory integrity
          </h2>
          <p className="mt-2 text-sm text-ink-300">
            Engineered under SEBI (Research Analysts) Regulations, 2014 and the Digital Personal Data Protection Act.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="group relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-brand-400/40 hover:bg-white/10 hover:shadow-[0_15px_30px_-10px_rgba(47,107,239,0.3)]"
            >
              <span className={`grid size-10 place-items-center rounded-xl ${stat.bg} ${stat.tone}`}>
                <stat.icon className="size-5" />
              </span>
              <div className="mt-4 font-mono text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {stat.value}
              </div>
              <h3 className="mt-1 text-sm font-semibold text-ink-100">{stat.label}</h3>
              <p className="mt-2 text-xs leading-5 text-ink-400">{stat.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
