import { RefreshCw, CheckCircle2, XCircle, Mail, HelpCircle, ArrowDown, ArrowRight } from "lucide-react";

export function RefundPolicyView() {
  return (
    <div className="space-y-10 text-[#F5F7FA]">
      {/* Intro Decision Tree Card */}
      <div className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Refund & Cancellation Decision Tree
        </h2>
        <p className="mt-2 text-sm text-[#9AA7B5]">
          Expert Stocks Consultancy maintains a clear, upfront refund policy across all research advisory tiers based on subscription activation status:
        </p>

        {/* Visual Decision Tree Diagram */}
        <div className="mt-6 rounded-xl border border-[#1C2734] bg-[#080D14] p-5 font-mono text-xs">
          {/* Step 1: Payment Remitted */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg bg-[#111923] border border-[#1C2734] px-4 py-2 font-semibold text-[#F5F7FA]">
              SUBSCRIPTION PAYMENT REMITTED
            </div>
            <ArrowDown className="size-4 text-[#43D9FF] my-2" />
          </div>

          {/* Step 2: Decision Node */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg bg-[#162130] border border-[#43D9FF]/40 px-5 py-2.5 font-bold text-[#43D9FF] text-center">
              HAS RESEARCH SERVICE ACTIVATED?
              <div className="text-[10px] font-normal text-[#9AA7B5] mt-0.5">
                (KYC Verified & Portal Access Provisioned)
              </div>
            </div>
          </div>

          {/* Branches */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* NO BRANCH (Pre-activation) */}
            <div className="rounded-xl border border-[#22C55E]/30 bg-[#0A170F] p-4 text-center">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#22C55E] uppercase mb-2">
                <CheckCircle2 className="size-3.5" />
                <span>NO &mdash; Pre-Activation</span>
              </div>
              <div className="text-xs text-[#F5F7FA] font-sans">
                Eligible for cancellation within <strong>48 hours</strong> of remittance.
              </div>
              <div className="mt-2 text-[11px] text-[#22C55E]">
                Refund processed in 7–10 working days
              </div>
            </div>

            {/* YES BRANCH (Post-activation) */}
            <div className="rounded-xl border border-[#F05252]/30 bg-[#170B0E] p-4 text-center">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F05252] uppercase mb-2">
                <XCircle className="size-3.5" />
                <span>YES &mdash; Post-Activation</span>
              </div>
              <div className="text-xs text-[#F5F7FA] font-sans">
                Live research output & IP consumed.
              </div>
              <div className="mt-2 text-[11px] text-[#F05252] font-semibold">
                No refunds or chargebacks permitted
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 01: Pre-Activation Cancellation */}
      <section id="pre-activation" className="rounded-2xl border-2 border-[#22C55E]/30 bg-[#07130B]/90 p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#22C55E] mb-3">
          <span className="size-6 rounded-md bg-[#0B1A10] border border-[#22C55E]/30 flex items-center justify-center font-bold">
            01
          </span>
          <span className="uppercase tracking-widest font-bold">Eligibility Period</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          1. Pre-Activation Cancellation
        </h3>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
          <p>
            Clients are strongly encouraged to review our published research methodology, sample reports, and statutory risk disclosures prior to making payments.
          </p>
          <div className="rounded-xl border border-[#22C55E]/20 bg-[#0B1A10] p-4 text-xs font-mono space-y-2 text-[#F5F7FA]">
            <p>
              • If a payment has been remitted but your subscription has <strong>not yet been activated</strong> (i.e. KYC documents or Risk Profiling have not been finalized), you may request a cancellation within <strong>48 hours</strong> of payment.
            </p>
            <p>
              • Approved pre-activation refunds are processed back to the original source bank account within <strong>7 to 10 working days</strong>, subject to deduction of applicable payment gateway transaction processing charges.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 02: Post-Activation Policy */}
      <section id="post-activation" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#F05252] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            02
          </span>
          <span className="uppercase tracking-widest font-semibold">Active Service Policy</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          2. Post-Activation Policy
        </h3>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
          <p>
            Once your subscription is activated and access to the Research Desk, live alert feeds, or client portal has been provisioned, <strong>no refunds or chargebacks will be granted</strong>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
            <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
              <div className="font-semibold text-[#F5F7FA] mb-1">Real-Time IP Consumption</div>
              <p className="text-[#9AA7B5]">
                Research advisory involves real-time analytical output and intellectual property consumption that cannot be revoked once dispatched.
              </p>
            </div>
            <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
              <div className="font-semibold text-[#F5F7FA] mb-1">Non-Transferable Term</div>
              <p className="text-[#9AA7B5]">
                Service periods cannot be paused, transferred to other parties, or exchanged for cash once active.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 03: Inquiries & Dispute Resolution */}
      <section id="inquiries" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            03
          </span>
          <span className="uppercase tracking-widest font-semibold">Billing Assistance</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          3. Inquiries & Dispute Resolution
        </h3>

        <div className="mt-4 rounded-xl border border-[#1C2734] bg-[#101923] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-[#667383]">Billing Clarifications & Invoices</div>
            <div className="text-base font-semibold font-mono text-[#F5F7FA] mt-0.5">info@expertstocks.in</div>
            <div className="text-xs text-[#9AA7B5] mt-1">
              Please include your Transaction Reference ID and registered Client Code.
            </div>
          </div>
          <a
            href="mailto:info@expertstocks.in?subject=Billing%20Inquiry%20-%20Expert%20Stocks"
            className="inline-flex items-center gap-2 rounded-lg bg-[#43D9FF] px-4 py-2 text-xs font-semibold text-[#05070B] hover:bg-[#33c9ef] transition-colors shrink-0"
          >
            <span>Email Billing Desk</span>
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      </section>
    </div>
  );
}
