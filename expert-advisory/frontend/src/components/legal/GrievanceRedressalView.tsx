import {
  Headset,
  Mail,
  Phone,
  MessageSquare,
  ShieldCheck,
  Building2,
  ExternalLink,
  Clock,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

export function GrievanceRedressalView() {
  return (
    <div className="space-y-10 text-[#F5F7FA]">
      {/* Intro Header Card */}
      <div className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Structured Dispute Resolution & Escalation Framework
        </h2>
        <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#9AA7B5]">
          Expert Stocks Consultancy maintains a structured, time-bound internal grievance handling mechanism. If you have an inquiry, technical issue, or formal complaint, please follow the escalation path below.
        </p>

        {/* Timeline Quick Indicator */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-[#1C2734] bg-[#101923] p-3 text-xs font-mono">
            <span className="size-6 rounded bg-[#43D9FF]/10 text-[#43D9FF] flex items-center justify-center font-bold">
              L1
            </span>
            <div>
              <div className="font-semibold text-[#F5F7FA]">Support Desk</div>
              <div className="text-[10px] text-[#667383]">24–48 Hours Response</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#1C2734] bg-[#101923] p-3 text-xs font-mono">
            <span className="size-6 rounded bg-[#7C5CFF]/10 text-[#7C5CFF] flex items-center justify-center font-bold">
              L2
            </span>
            <div>
              <div className="font-semibold text-[#F5F7FA]">Grievance Officer & Compliance Cell</div>
              <div className="text-[10px] text-[#667383]">Internal Resolution</div>
            </div>
          </div>
        </div>
      </div>

      {/* LEVEL 1: Client Support Desk */}
      <section id="level-1" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8 relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF]">
            <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
              01
            </span>
            <span className="uppercase tracking-widest font-semibold">Tier 1 · First Contact</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[#162130] px-2.5 py-1 text-[11px] font-mono text-[#43D9FF]">
            <Clock className="size-3" />
            <span>TAT: 24–48 Hours</span>
          </div>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Client Support Desk
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#9AA7B5]">
          For service onboarding, research access, invoice clarification, or technical assistance, reach out directly to our dedicated customer desk:
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#667383] mb-1">
                <Mail className="size-3.5 text-[#43D9FF]" />
                <span>EMAIL SUPPORT</span>
              </div>
              <div className="text-sm font-semibold font-mono text-[#F5F7FA]">
                info@expertstocks.in
              </div>
            </div>
            <a
              href="mailto:info@expertstocks.in"
              className="mt-4 inline-flex items-center gap-1 text-xs font-mono text-[#43D9FF] hover:underline"
            >
              <span>Send Message</span>
              <ArrowRight className="size-3" />
            </a>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#667383] mb-1">
                <Phone className="size-3.5 text-[#22C55E]" />
                <span>PHONE & WHATSAPP</span>
              </div>
              <div className="text-sm font-semibold font-mono text-[#F5F7FA]">
                +91 95896 15649
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs font-mono">
              <a href="tel:+919589615649" className="text-[#9AA7B5] hover:text-[#F5F7FA]">
                Direct Call
              </a>
              <span className="text-[#1C2734]">│</span>
              <a
                href="https://wa.me/919589615649"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#22C55E] hover:underline"
              >
                WhatsApp Desk
              </a>
            </div>
          </div>
        </div>

        <div className="mt-4 text-[11px] font-mono text-[#667383]">
          Operating Hours: Monday to Friday, 9:00 AM to 4:00 PM IST (Excluding NSE/BSE Exchange Holidays).
        </div>
      </section>

      {/* LEVEL 2: Grievance Officer Escalation */}
      <section id="level-2" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-xs font-mono text-[#7C5CFF]">
            <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
              02
            </span>
            <span className="uppercase tracking-widest font-semibold">Tier 2 · Internal Escalation</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[#1a142e] px-2.5 py-1 text-[11px] font-mono text-[#7C5CFF]">
            <ShieldCheck className="size-3" />
            <span>Statutory SLA: 21 Calendar Days</span>
          </div>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Grievance Officer & Compliance Cell
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#9AA7B5]">
          If your issue is not resolved within 3 business days by the Client Support Desk, or if the proposed resolution is unsatisfactory, you may register a formal grievance with our designated Grievance Officer:
        </p>

        <div className="mt-5 rounded-xl border border-[#1C2734] bg-[#101923] p-5 space-y-3 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[#667383] block">DESIGNATION & DEPARTMENT:</span>
              <span className="font-semibold text-[#F5F7FA]">Grievance & Compliance Cell</span>
            </div>
            <div>
              <span className="text-[#667383] block">ESCALATION EMAIL:</span>
              <a href="mailto:support@expertstocks.in" className="font-semibold text-[#43D9FF] hover:underline">
                support@expertstocks.in
              </a>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1C2734]">
            <span className="text-[#667383] block mb-1">REGISTERED OFFICE ADDRESS:</span>
            <span className="text-[#9AA7B5]">
              ITC Park, Belapur Station Complex, Sector-11, CBD Belapur, Navi Mumbai, Maharashtra 400614
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
