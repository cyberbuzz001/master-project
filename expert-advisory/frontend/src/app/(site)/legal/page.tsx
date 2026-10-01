"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Headset,
  Lock,
  FileCheck,
  RefreshCw,
  Cookie,
  ArrowRight,
  ShieldCheck,
  Search,
  Scale,
  Building2,
  ExternalLink,
} from "lucide-react";
import { Container } from "@/components/ui";
import { LEGAL_DOCS } from "@/components/legal/legal-data";

const ICON_MAP: Record<string, typeof AlertTriangle> = {
  "alert-triangle": AlertTriangle,
  scale: Scale,
  headset: Headset,
  lock: Lock,
  "file-check": FileCheck,
  "refresh-cw": RefreshCw,
  cookie: Cookie,
};

export default function LegalHubPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDocs = LEGAL_DOCS.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.lead.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="bg-[#05070B] min-h-screen py-12 sm:py-16">
      <Container className="max-w-6xl">
        {/* Hub Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1C2734] bg-[#0D131C] px-3.5 py-1 text-xs font-mono text-[#43D9FF]">
            <span className="size-1.5 rounded-full bg-[#43D9FF] animate-pulse" />
            <span>EXPERT STOCKS TRUST CENTER</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#F5F7FA] font-display text-balance">
            Trust & Compliance
          </h1>

          <p className="text-base sm:text-lg text-[#9AA7B5] leading-relaxed text-pretty">
            Access our statutory policies, investor charters, risk disclosures, and grievance mechanisms in one unified compliance repository.
          </p>

          {/* Interactive Search Bar */}
          <div className="pt-4 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 size-4 text-[#667383]" />
              <input
                type="text"
                placeholder="Search policies, disclosures & compliance topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#1C2734] bg-[#0D131C] pl-11 pr-4 py-3 text-sm font-mono text-[#F5F7FA] placeholder-[#667383] focus:border-[#43D9FF] focus:outline-none transition-colors shadow-lg"
              />
            </div>
            <div className="mt-2 text-xs font-mono text-[#667383] flex items-center justify-center gap-3">
              <span>Try:</span>
              <button
                type="button"
                onClick={() => setSearchQuery("risk")}
                className="hover:text-[#43D9FF] transition-colors underline"
              >
                &ldquo;risk&rdquo;
              </button>
              <button
                type="button"
                onClick={() => setSearchQuery("grievance")}
                className="hover:text-[#43D9FF] transition-colors underline"
              >
                &ldquo;grievance&rdquo;
              </button>
              <button
                type="button"
                onClick={() => setSearchQuery("refund")}
                className="hover:text-[#43D9FF] transition-colors underline"
              >
                &ldquo;refund&rdquo;
              </button>
              <button
                type="button"
                onClick={() => setSearchQuery("sebi")}
                className="hover:text-[#43D9FF] transition-colors underline"
              >
                &ldquo;sebi&rdquo;
              </button>
            </div>
          </div>
        </div>

        {/* 7 Policy Cards Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => {
            const Icon = ICON_MAP[doc.iconName] || FileText;
            return (
              <Link
                key={doc.slug}
                href={`/legal/${doc.slug}`}
                className="group rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 hover:border-[#43D9FF]/40 hover:bg-[#101923] transition-all flex flex-col justify-between shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="size-10 rounded-xl bg-[#162130] border border-[#1C2734] flex items-center justify-center text-[#43D9FF] group-hover:scale-105 transition-transform">
                      <Icon className="size-5" />
                    </div>
                    <span className="text-[11px] font-mono text-[#667383] bg-[#080D14] px-2.5 py-1 rounded-full border border-[#1C2734]">
                      {doc.categoryBadge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold font-display text-[#F5F7FA] group-hover:text-[#43D9FF] transition-colors">
                    {doc.title}
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm text-[#9AA7B5] leading-relaxed line-clamp-3">
                    {doc.lead}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1C2734]/80 flex items-center justify-between text-xs font-mono text-[#43D9FF]">
                  <span>Read Document</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Trust Center Regulatory Verification Strip */}
        <div className="mt-12 rounded-2xl border border-[#1C2734] bg-[#080D14] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#22C55E] text-xs font-mono font-bold uppercase tracking-wider">
              <ShieldCheck className="size-4" />
              <span>Verified Regulatory Intermediary Profile</span>
            </div>
            <h4 className="text-base font-bold font-display text-[#F5F7FA]">
              Looking for Corporate Identity & Licensing Proofs?
            </h4>
            <p className="text-xs text-[#9AA7B5] max-w-2xl">
              Inspect our registered legal entity name, corporate office addresses, SEBI Research Analyst credentials, Principal Officer details, and statutory review schedules in the Trust Center.
            </p>
          </div>

          <Link
            href="/trust-center"
            className="inline-flex items-center gap-2 rounded-xl bg-[#162130] border border-[#1C2734] hover:border-[#43D9FF]/40 px-5 py-2.5 text-xs font-mono font-semibold text-[#F5F7FA] hover:text-[#43D9FF] transition-all shrink-0"
          >
            <span>Open Trust Center</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </Container>
    </div>
  );
}
