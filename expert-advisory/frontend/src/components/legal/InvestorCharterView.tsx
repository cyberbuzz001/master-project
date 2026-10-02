import { CheckCircle2, XCircle, ShieldCheck, Scale, Compass, FileCheck2, ArrowUpRight } from "lucide-react";

export function InvestorCharterView() {
  return (
    <div className="space-y-10 text-[#F5F7FA]">
      {/* 4 Quick Jump Dashboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <a
          href="#mission"
          className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4 hover:border-[#43D9FF]/40 hover:bg-[#111923] transition-all group"
        >
          <div className="text-[10px] font-mono text-[#43D9FF] mb-1">01 SECTION</div>
          <div className="text-xs sm:text-sm font-bold font-display text-[#F5F7FA] group-hover:text-[#43D9FF] transition-colors">
            Our Mission & Vision
          </div>
        </a>

        <a
          href="#services"
          className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4 hover:border-[#43D9FF]/40 hover:bg-[#111923] transition-all group"
        >
          <div className="text-[10px] font-mono text-[#43D9FF] mb-1">02 SECTION</div>
          <div className="text-xs sm:text-sm font-bold font-display text-[#F5F7FA] group-hover:text-[#43D9FF] transition-colors">
            Services Provided
          </div>
        </a>

        <a
          href="#rights"
          className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4 hover:border-[#43D9FF]/40 hover:bg-[#111923] transition-all group"
        >
          <div className="text-[10px] font-mono text-[#22C55E] mb-1">03 CORE</div>
          <div className="text-xs sm:text-sm font-bold font-display text-[#F5F7FA] group-hover:text-[#22C55E] transition-colors">
            Investor Rights
          </div>
        </a>

        <a
          href="#dos-donts"
          className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4 hover:border-[#43D9FF]/40 hover:bg-[#111923] transition-all group"
        >
          <div className="text-[10px] font-mono text-[#F5B84B] mb-1">04 MATRIX</div>
          <div className="text-xs sm:text-sm font-bold font-display text-[#F5F7FA] group-hover:text-[#F5B84B] transition-colors">
            Do&apos;s & Don&apos;ts
          </div>
        </a>
      </div>

      {/* SECTION 01: Vision & Mission */}
      <section id="mission" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <Compass className="size-4" />
          <span className="uppercase tracking-widest">Section A · Strategic Mandate</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Vision & Mission of Research Analysts
        </h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-5">
            <div className="text-xs font-mono uppercase tracking-wider text-[#43D9FF] mb-2 font-bold">
              Vision Statement
            </div>
            <p className="text-sm leading-relaxed text-[#9AA7B5]">
              To protect investor interests and promote fair, transparent capital markets through rigorous quantitative methods, transparent disclosures, and dual-control analytical verification.
            </p>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-5">
            <div className="text-xs font-mono uppercase tracking-wider text-[#7C5CFF] mb-2 font-bold">
              Mission Statement
            </div>
            <p className="text-sm leading-relaxed text-[#9AA7B5]">
              To maintain the highest standards of professional ethics, analytical diligence, and complete disclosure of financial interests or affiliations across all publications.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 02: Details of Services Provided */}
      <section id="services" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <FileCheck2 className="size-4" />
          <span className="uppercase tracking-widest">Section B · Advisory Services</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Details of Services Provided
        </h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4 flex items-start gap-3">
            <span className="size-6 rounded bg-[#162130] text-[#43D9FF] font-mono text-xs flex items-center justify-center font-bold shrink-0">
              01
            </span>
            <div>
              <div className="text-sm font-semibold text-[#F5F7FA]">Objective Market Research</div>
              <p className="mt-1 text-xs leading-relaxed text-[#9AA7B5]">
                Publishing data-driven, objective research reports on listed Indian equities, sectoral themes, and market indices.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4 flex items-start gap-3">
            <span className="size-6 rounded bg-[#162130] text-[#43D9FF] font-mono text-xs flex items-center justify-center font-bold shrink-0">
              02
            </span>
            <div>
              <div className="text-sm font-semibold text-[#F5F7FA]">Structured Time Horizons</div>
              <p className="mt-1 text-xs leading-relaxed text-[#9AA7B5]">
                Formulating research setups with transparent time horizons, entry rationales, invalidation stop points, and risk metrics.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4 flex items-start gap-3">
            <span className="size-6 rounded bg-[#162130] text-[#43D9FF] font-mono text-xs flex items-center justify-center font-bold shrink-0">
              03
            </span>
            <div>
              <div className="text-sm font-semibold text-[#F5F7FA]">Mandatory Suitability Screening</div>
              <p className="mt-1 text-xs leading-relaxed text-[#9AA7B5]">
                Conducting mandatory suitability evaluations and risk profiling prior to onboarding clients to premium research services.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4 flex items-start gap-3">
            <span className="size-6 rounded bg-[#162130] text-[#43D9FF] font-mono text-xs flex items-center justify-center font-bold shrink-0">
              04
            </span>
            <div>
              <div className="text-sm font-semibold text-[#F5F7FA]">Regulatory Standard Compliance</div>
              <p className="mt-1 text-xs leading-relaxed text-[#9AA7B5]">
                Ensuring all public statements, disclosures, and communications conform strictly to the SEBI (Research Analysts) Regulations, 2014.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 03: Rights of Investors (High Prominence) */}
      <section id="rights" className="rounded-2xl border-2 border-[#22C55E]/30 bg-[#07130B]/90 p-6 sm:p-8 shadow-[0_0_30px_rgba(34,197,94,0.06)]">
        <div className="flex items-center gap-3 text-xs font-mono text-[#22C55E] mb-3">
          <Scale className="size-4" />
          <span className="uppercase tracking-widest font-bold">Section C · Fundamental Protections</span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold font-display text-[#F5F7FA]">
          Rights of Investors
        </h3>
        <p className="mt-2 text-sm text-[#9AA7B5]">
          As an investor engaging with authorized research analyst entities, you are entitled to the following statutory rights:
        </p>

        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-[#22C55E]/20 bg-[#0B1A10] p-4 flex items-start gap-3.5">
            <CheckCircle2 className="size-5 text-[#22C55E] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-[#F5F7FA]">Authentic & Unbiased Research</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#9AA7B5]">
                Right to receive authentic research reports that include mandatory disclosures regarding financial interests, holding positions, or business relationships.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#22C55E]/20 bg-[#0B1A10] p-4 flex items-start gap-3.5">
            <CheckCircle2 className="size-5 text-[#22C55E] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-[#F5F7FA]">Transparent Fee Disclosure</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#9AA7B5]">
                Right to be informed of all fee schedules, statutory GST levies, validity periods, and terms of service in writing prior to remitting subscription payments.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#22C55E]/20 bg-[#0B1A10] p-4 flex items-start gap-3.5">
            <CheckCircle2 className="size-5 text-[#22C55E] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-[#F5F7FA]">Timely Grievance Redressal (21 Calendar Days)</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#9AA7B5]">
                Right to prompt resolution of grievances within 21 calendar days per SEBI redressal frameworks through an established escalation matrix.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#22C55E]/20 bg-[#0B1A10] p-4 flex items-start gap-3.5">
            <CheckCircle2 className="size-5 text-[#22C55E] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-[#F5F7FA]">Dedicated Compliance Escalation Desk</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#9AA7B5]">
                Direct access to the Principal Grievance Officer and designated Compliance Cell for structured review and resolution of all queries.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 04: Do's and Don'ts (Two-Column Comparison) */}
      <section id="dos-donts" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#F5B84B] mb-3">
          <ShieldCheck className="size-4" />
          <span className="uppercase tracking-widest font-bold">Section D · Investor Responsibility Guide</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Do&apos;s and Don&apos;ts for Market Participants
        </h3>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* DO COLUMN */}
          <div className="rounded-xl border border-[#22C55E]/30 bg-[#0A160F] p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#22C55E] pb-2 border-b border-[#22C55E]/20">
              <CheckCircle2 className="size-4" />
              <span>DO &mdash; Best Practices</span>
            </div>

            <div className="space-y-3 text-xs font-mono text-[#F5F7FA] pt-1">
              <div className="flex items-start gap-2.5">
                <span className="text-[#22C55E] font-bold">✓</span>
                <span><strong>Verify credentials:</strong> Cross-check Research Analyst registration details on the official SEBI website.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[#22C55E] font-bold">✓</span>
                <span><strong>Complete risk profile:</strong> Answer suitability questionnaires honestly to align research with your risk appetite.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[#22C55E] font-bold">✓</span>
                <span><strong>Understand your risk:</strong> Read related offer documents and statutory disclosures carefully before taking positions.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[#22C55E] font-bold">✓</span>
                <span><strong>Use authorized channels:</strong> Verify that banking remittances go strictly to the registered corporate entity account.</span>
              </div>
            </div>
          </div>

          {/* DON'T COLUMN */}
          <div className="rounded-xl border border-[#F05252]/30 bg-[#160D10] p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#F05252] pb-2 border-b border-[#F05252]/20">
              <XCircle className="size-4" />
              <span>DON&apos;T &mdash; Prohibited Practices</span>
            </div>

            <div className="space-y-3 text-xs font-mono text-[#F5F7FA] pt-1">
              <div className="flex items-start gap-2.5">
                <span className="text-[#F05252] font-bold">✕</span>
                <span><strong>Follow rumours:</strong> Do NOT act on unverified social media tips, telegram groups, or forwarded messages.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[#F05252] font-bold">✕</span>
                <span><strong>Pay personal accounts:</strong> NEVER deposit advisory fees into personal accounts of staff or representatives.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[#F05252] font-bold">✕</span>
                <span><strong>Expect guaranteed profits:</strong> Do NOT trust claims of fixed returns or zero-risk stock market schemes.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[#F05252] font-bold">✕</span>
                <span><strong>Share trading credentials:</strong> NEVER disclose demat or trading account login details to third parties.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
