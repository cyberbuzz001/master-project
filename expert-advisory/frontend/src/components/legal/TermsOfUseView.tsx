"use client";

import { useState, useEffect } from "react";
import { Check, ShieldAlert, BookOpen, AlertOctagon, Scale, Award } from "lucide-react";

const SECTIONS = [
  { id: "acceptance", num: "01", title: "Acceptance" },
  { id: "services", num: "02", title: "Nature of Services" },
  { id: "intellectual-property", num: "03", title: "Intellectual Property" },
  { id: "liability", num: "04", title: "Limitation of Liability" },
  { id: "governing-law", num: "05", title: "Governing Law" },
];

export function TermsOfUseView() {
  const [activeSection, setActiveSection] = useState("acceptance");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="space-y-8 text-[#F5F7FA]">
      {/* Sticky Progress Indicator */}
      <div className="sticky top-20 z-20 rounded-xl border border-[#1C2734] bg-[#080D14]/95 backdrop-blur-md p-3 shadow-lg print:hidden">
        <div className="flex items-center justify-between overflow-x-auto no-scrollbar gap-2 text-xs font-mono">
          {SECTIONS.map((sec, idx) => {
            const isActive = activeSection === sec.id;
            return (
              <div key={sec.id} className="flex items-center gap-2 shrink-0">
                <a
                  href={`#${sec.id}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                    isActive
                      ? "bg-[#43D9FF]/15 text-[#43D9FF] font-semibold border border-[#43D9FF]/30"
                      : "text-[#667383] hover:text-[#9AA7B5]"
                  }`}
                >
                  <span>{sec.num}</span>
                  <span className="hidden sm:inline">{sec.title}</span>
                </a>
                {idx < SECTIONS.length - 1 && (
                  <span className="text-[#1C2734]">━━━━</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 01: Acceptance of Terms */}
      <section id="acceptance" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            01
          </span>
          <span className="uppercase tracking-widest">Enforceability</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          1. Acceptance of Terms
        </h3>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
          <p>
            These Terms of Use govern your access to and use of the website, analytical reports, mobile services, and client portal operated by <strong>Expert Stocks Consultancy</strong>.
          </p>
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4 text-xs font-mono">
            By accessing or using this website, you confirm that you are at least 18 years of age, legally competent to enter into binding agreements under the Indian Contract Act, 1872, and agree to abide by these Terms in full.
          </div>
        </div>
      </section>

      {/* SECTION 02: Nature of Services */}
      <section id="services" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            02
          </span>
          <span className="uppercase tracking-widest">Scope & Character</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          2. Nature of Services
        </h3>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#43D9FF] mb-1">
              Analytical & Research Commentary
            </h4>
            <p className="text-xs">
              All research, technical setups, chart patterns, and market commentaries published by Expert Stocks Consultancy are for analytical and informational purposes only.
            </p>
          </div>

          <div className="rounded-xl border border-[#F05252]/20 bg-[#160D10] p-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F05252] mb-1">
              No Guaranteed Returns or Assured Profits
            </h4>
            <p className="text-xs text-[#F5F7FA]">
              We do NOT offer guaranteed profits, assured return schemes, portfolio management services (PMS), or profit-sharing arrangements.
            </p>
          </div>

          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#7C5CFF] mb-1">
              Risk Assessment Prerequisite
            </h4>
            <p className="text-xs">
              Access to specialized advisory tiers requires prior completion and acknowledgment of our structured Risk Assessment Questionnaire.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 03: Intellectual Property */}
      <section id="intellectual-property" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            03
          </span>
          <span className="uppercase tracking-widest">Proprietary Rights</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          3. Intellectual Property Rights
        </h3>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
          <p>
            All publications, indicator methodologies, chart graphics, written research notes, and portal designs are the proprietary intellectual property of Expert Stocks Consultancy.
          </p>
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4 text-xs font-mono space-y-2">
            <p className="text-[#22C55E]">
              ✓ Personal License: You are granted a personal, non-transferable, revocable license to view research for your own individual investing.
            </p>
            <p className="text-[#F05252]">
              ✕ Redistribution Prohibited: Scraping, reselling, or broadcasting our research to third parties or social channels is strictly prohibited and subject to legal recourse.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 04: Limitation of Liability */}
      <section id="liability" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#F59E0B] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            04
          </span>
          <span className="uppercase tracking-widest">Risk Disclaimer</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          4. Limitation of Liability
        </h3>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
          <p>
            Trading and investing in Indian capital markets (NSE, BSE, MCX) involve inherent financial volatility.
          </p>
          <div className="rounded-xl border border-[#F59E0B]/20 bg-[#161208] p-4 text-xs font-mono text-[#F5F7FA]">
            Expert Stocks Consultancy and its analysts expressly disclaim liability for any direct, indirect, incidental, or consequential capital drawdowns or financial losses incurred from actions taken based on published research.
          </div>
        </div>
      </section>

      {/* SECTION 05: Governing Law & Jurisdiction */}
      <section id="governing-law" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            05
          </span>
          <span className="uppercase tracking-widest">Legal Forum</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          5. Governing Law & Jurisdiction
        </h3>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
          <p>
            These Terms are governed by and construed in accordance with the laws of the Republic of India. Any disputes arising hereunder shall be subject to the exclusive jurisdiction of the competent courts in Navi Mumbai / Mumbai, Maharashtra.
          </p>
        </div>
      </section>
    </div>
  );
}
