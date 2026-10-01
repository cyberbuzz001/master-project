import { Lock, UserCheck, ShieldCheck, Database, KeyRound, Server, Eye, FileText } from "lucide-react";

export function PrivacyPolicyView() {
  return (
    <div className="space-y-10 text-[#F5F7FA]">
      {/* Intro Entity Panel */}
      <div className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1C2734] pb-4 mb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#43D9FF]">Data Controller</div>
            <div className="text-base font-bold font-display text-[#F5F7FA]">Expert Stocks Consultancy</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono text-[#667383]">Data Protection & Grievance Contact</div>
            <div className="text-xs font-mono text-[#43D9FF]">privacy@expertstocks.in │ grievance@expertstocks.in</div>
          </div>
        </div>
        <p className="text-xs font-mono text-[#9AA7B5] leading-relaxed">
          Registered Office: ITC Park, Belapur Station Complex, Sector-11, CBD Belapur, Navi Mumbai, Maharashtra 400614
        </p>
      </div>

      {/* SECTION 01: Information We Collect */}
      <section id="collection" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            01
          </span>
          <span className="uppercase tracking-widest">Data Inventory</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          1. Information We Collect
        </h3>
        <p className="mt-2 text-sm text-[#9AA7B5]">
          We collect personal information necessary to deliver compliant research advisory and regulatory communications:
        </p>

        {/* 3 Visual Data Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card A: Contact Details */}
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#43D9FF] uppercase tracking-wider">
              <UserCheck className="size-4" />
              <span>Contact Data</span>
            </div>
            <ul className="space-y-1.5 text-xs font-mono text-[#9AA7B5]">
              <li className="flex items-center gap-1.5">
                <span className="text-[#43D9FF]">▪</span> Full Legal Name
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#43D9FF]">▪</span> Mobile Telephone Number
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#43D9FF]">▪</span> Primary Email Address
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#43D9FF]">▪</span> Residential City & State
              </li>
            </ul>
          </div>

          {/* Card B: Onboarding Data */}
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#7C5CFF] uppercase tracking-wider">
              <FileText className="size-4" />
              <span>Onboarding Data</span>
            </div>
            <ul className="space-y-1.5 text-xs font-mono text-[#9AA7B5]">
              <li className="flex items-center gap-1.5">
                <span className="text-[#7C5CFF]">▪</span> KYC Proofs (PAN Card)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#7C5CFF]">▪</span> Suitability Questionnaires
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#7C5CFF]">▪</span> Risk Profile Scores
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#7C5CFF]">▪</span> Signed Agreements & Invoices
              </li>
            </ul>
          </div>

          {/* Card C: Technical Records */}
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#22C55E] uppercase tracking-wider">
              <Server className="size-4" />
              <span>Technical Records</span>
            </div>
            <ul className="space-y-1.5 text-xs font-mono text-[#9AA7B5]">
              <li className="flex items-center gap-1.5">
                <span className="text-[#22C55E]">▪</span> IP Address & Timestamp
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#22C55E]">▪</span> Browser Agent & Version
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#22C55E]">▪</span> Device Fingerprint
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#22C55E]">▪</span> Portal Authentication Logs
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* SECTION 02: Purpose of Data Processing */}
      <section id="processing-purposes" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            02
          </span>
          <span className="uppercase tracking-widest">Lawful Basis</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          2. Purpose of Data Processing
        </h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
            <div className="font-semibold text-[#43D9FF] mb-1">Risk Suitability Evaluation</div>
            <p className="text-[#9AA7B5] leading-normal font-sans text-xs">
              To assess your investment experience, risk appetite, and financial horizon through mandatory suitability evaluations prior to advisory delivery.
            </p>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
            <div className="font-semibold text-[#43D9FF] mb-1">Research Delivery</div>
            <p className="text-[#9AA7B5] leading-normal font-sans text-xs">
              To transmit authorized research publications, timely alerts, market commentaries, and administrative client service notices.
            </p>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
            <div className="font-semibold text-[#43D9FF] mb-1">Affirmative Consent Communication</div>
            <p className="text-[#9AA7B5] leading-normal font-sans text-xs">
              To communicate via phone, SMS, email, or WhatsApp strictly based on your affirmative consent selections.
            </p>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
            <div className="font-semibold text-[#43D9FF] mb-1">Regulatory Record-Keeping</div>
            <p className="text-[#9AA7B5] leading-normal font-sans text-xs">
              To fulfill statutory compliance, audit trail maintenance, and SEBI regulatory record-keeping standards.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 03: Consent and Your Rights */}
      <section id="rights" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#22C55E] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            03
          </span>
          <span className="uppercase tracking-widest">User Control</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          3. Consent & Your Data Rights
        </h3>

        <div className="mt-5 space-y-3 text-xs leading-relaxed text-[#9AA7B5]">
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
            <div className="font-semibold text-[#F5F7FA] font-mono mb-1">Right to Access & Rectify</div>
            <p>
              You may inspect your records and update inaccurate personal details at any time through the client portal or by emailing info@expertstocks.in.
            </p>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
            <div className="font-semibold text-[#F5F7FA] font-mono mb-1">Withdrawal of Consent</div>
            <p>
              You may withdraw marketing or channel-specific communications (such as WhatsApp or promotional calls) by adjusting your account preferences or contacting support.
            </p>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
            <div className="font-semibold text-[#F5F7FA] font-mono mb-1">Data Protection Inquiries</div>
            <p>
              Escalations regarding data handling may be lodged directly with our Grievance & Data Protection Officer at grievance@expertstocks.in.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 04: Retention & Encryption Safeguards */}
      <section id="retention" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            04
          </span>
          <span className="uppercase tracking-widest">Security Architecture</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          4. Data Retention & Safeguards
        </h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-5">
            <div className="flex items-center gap-2 text-xs font-mono text-[#43D9FF] mb-2 font-bold">
              <Database className="size-4" />
              <span>5-Year Statutory Retention</span>
            </div>
            <p className="text-xs text-[#9AA7B5] leading-relaxed">
              Client KYC, transaction history, risk profiling questionnaires, and research transmission records are retained securely for a minimum statutory duration of 5 years in compliance with applicable Indian financial regulations.
            </p>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-5">
            <div className="flex items-center gap-2 text-xs font-mono text-[#22C55E] mb-2 font-bold">
              <KeyRound className="size-4" />
              <span>TLS 1.3 & AES-256 Encryption</span>
            </div>
            <p className="text-xs text-[#9AA7B5] leading-relaxed">
              All data transmitted between your browser and our servers is protected using TLS 1.3 transport security. Database records and sensitive identifiers are encrypted at rest with industry-standard AES-256 encryption.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
