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
  ChevronDown,
  Search,
  ShieldCheck,
  ArrowUpRight,
  Sliders,
} from "lucide-react";
import { LEGAL_DOCS, type LegalDocInfo } from "./legal-data";

interface LegalNavSidebarProps {
  currentSlug: string;
}

const ICON_MAP: Record<string, typeof AlertTriangle> = {
  "alert-triangle": AlertTriangle,
  scale: FileText,
  headset: Headset,
  lock: Lock,
  "file-check": FileCheck,
  "refresh-cw": RefreshCw,
  cookie: Cookie,
};

export function LegalNavSidebar({ currentSlug }: LegalNavSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const filteredDocs = LEGAL_DOCS.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.lead.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentDoc = LEGAL_DOCS.find((d) => d.slug === currentSlug);

  return (
    <>
      {/* Mobile Document Selector Dropdown Bar */}
      <div className="lg:hidden mb-6 print:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between rounded-xl border border-[#1C2734] bg-[#0D131C] px-4 py-3 text-sm font-medium text-[#F5F7FA] shadow-md focus:outline-none focus:ring-1 focus:ring-[#43D9FF]"
        >
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-[#43D9FF] animate-pulse" />
            <span className="font-mono text-xs text-[#667383]">CURRENT DOCUMENT:</span>
            <span className="font-semibold text-[#43D9FF]">{currentDoc?.title ?? "Document Selector"}</span>
          </div>
          <ChevronDown
            className={`size-4 text-[#9AA7B5] transition-transform duration-200 ${
              mobileMenuOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {mobileMenuOpen && (
          <div className="mt-2 rounded-xl border border-[#1C2734] bg-[#080D14] p-3 shadow-xl space-y-1">
            <div className="px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[#667383]">
              Trust & Compliance Directory
            </div>
            {LEGAL_DOCS.map((doc) => {
              const Icon = ICON_MAP[doc.iconName] || FileText;
              const isActive = doc.slug === currentSlug;
              return (
                <Link
                  key={doc.slug}
                  href={`/legal/${doc.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-mono transition-all ${
                    isActive
                      ? "bg-[#43D9FF]/10 text-[#43D9FF] font-semibold border border-[#43D9FF]/30"
                      : "text-[#9AA7B5] hover:bg-[#111923] hover:text-[#F5F7FA]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-3.5" />
                    <span>{doc.title}</span>
                  </div>
                  <span className="text-[10px] text-[#667383]">{doc.categoryBadge}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-[#1C2734] mt-2">
              <Link
                href="/legal"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 text-xs font-mono text-[#43D9FF] hover:underline"
              >
                <span>Browse All Policies (Hub)</span>
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 print:hidden">
        <div className="sticky top-24 space-y-6">
          {/* Document Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-[#667383]" />
            <input
              type="text"
              placeholder="Search policies & disclosures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#1C2734] bg-[#080D14] pl-9 pr-3 py-2 text-xs font-mono text-[#F5F7FA] placeholder-[#667383] focus:border-[#43D9FF] focus:outline-none transition-colors"
            />
          </div>

          {/* Hub Overview Link */}
          <Link
            href="/legal"
            className="flex items-center justify-between rounded-xl border border-[#1C2734] bg-[#0D131C] px-3.5 py-2.5 text-xs font-mono text-[#F5F7FA] hover:border-[#43D9FF]/40 hover:bg-[#111923] transition-all group"
          >
            <span className="font-semibold tracking-wider text-[#9AA7B5] group-hover:text-[#43D9FF]">
              TRUST & COMPLIANCE HUB
            </span>
            <ArrowUpRight className="size-3.5 text-[#667383] group-hover:text-[#43D9FF] transition-colors" />
          </Link>

          {/* Group 1: Disclosures */}
          <div className="space-y-2">
            <div className="px-3 text-[10px] font-mono uppercase tracking-widest text-[#667383]">
              Disclosures
            </div>
            <div className="space-y-1">
              {filteredDocs
                .filter((d) => d.category === "Disclosures")
                .map((doc) => {
                  const Icon = ICON_MAP[doc.iconName] || FileText;
                  const isActive = doc.slug === currentSlug;
                  return (
                    <Link
                      key={doc.slug}
                      href={`/legal/${doc.slug}`}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-mono transition-all relative ${
                        isActive
                          ? "bg-[#43D9FF]/10 text-[#43D9FF] font-semibold border border-[#43D9FF]/30 shadow-[0_0_15px_rgba(67,217,255,0.08)]"
                          : "text-[#9AA7B5] hover:bg-[#0D131C] hover:text-[#F5F7FA] border border-transparent"
                      }`}
                    >
                      <Icon className={`size-3.5 shrink-0 ${isActive ? "text-[#43D9FF]" : "text-[#667383]"}`} />
                      <span className="truncate">{doc.title}</span>
                      {isActive && (
                        <span className="ml-auto size-1.5 rounded-full bg-[#43D9FF] animate-pulse" />
                      )}
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* Group 2: Investor Protection */}
          <div className="space-y-2">
            <div className="px-3 text-[10px] font-mono uppercase tracking-widest text-[#667383]">
              Investor Protection
            </div>
            <div className="space-y-1">
              {filteredDocs
                .filter((d) => d.category === "Investor Protection")
                .map((doc) => {
                  const Icon = ICON_MAP[doc.iconName] || FileText;
                  const isActive = doc.slug === currentSlug;
                  return (
                    <Link
                      key={doc.slug}
                      href={`/legal/${doc.slug}`}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-mono transition-all relative ${
                        isActive
                          ? "bg-[#43D9FF]/10 text-[#43D9FF] font-semibold border border-[#43D9FF]/30 shadow-[0_0_15px_rgba(67,217,255,0.08)]"
                          : "text-[#9AA7B5] hover:bg-[#0D131C] hover:text-[#F5F7FA] border border-transparent"
                      }`}
                    >
                      <Icon className={`size-3.5 shrink-0 ${isActive ? "text-[#43D9FF]" : "text-[#667383]"}`} />
                      <span className="truncate">{doc.title}</span>
                      {isActive && (
                        <span className="ml-auto size-1.5 rounded-full bg-[#43D9FF] animate-pulse" />
                      )}
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* Group 3: Policies */}
          <div className="space-y-2">
            <div className="px-3 text-[10px] font-mono uppercase tracking-widest text-[#667383]">
              Governance Policies
            </div>
            <div className="space-y-1">
              {filteredDocs
                .filter((d) => d.category === "Policies")
                .map((doc) => {
                  const Icon = ICON_MAP[doc.iconName] || FileText;
                  const isActive = doc.slug === currentSlug;
                  return (
                    <Link
                      key={doc.slug}
                      href={`/legal/${doc.slug}`}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-mono transition-all relative ${
                        isActive
                          ? "bg-[#43D9FF]/10 text-[#43D9FF] font-semibold border border-[#43D9FF]/30 shadow-[0_0_15px_rgba(67,217,255,0.08)]"
                          : "text-[#9AA7B5] hover:bg-[#0D131C] hover:text-[#F5F7FA] border border-transparent"
                      }`}
                    >
                      <Icon className={`size-3.5 shrink-0 ${isActive ? "text-[#43D9FF]" : "text-[#667383]"}`} />
                      <span className="truncate">{doc.title}</span>
                      {isActive && (
                        <span className="ml-auto size-1.5 rounded-full bg-[#43D9FF] animate-pulse" />
                      )}
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* Regulatory Verification Banner */}
          <div className="rounded-xl border border-[#1C2734] bg-[#080D14] p-4 text-xs font-mono space-y-2">
            <div className="flex items-center gap-2 text-[#22C55E]">
              <ShieldCheck className="size-4" />
              <span className="font-semibold uppercase tracking-wider">SEBI Aligned</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#667383]">
              Operating under SEBI (Research Analysts) Regulations. Full entity profiles and credentials available in Trust Center.
            </p>
            <Link
              href="/trust-center"
              className="inline-flex items-center gap-1 text-[11px] text-[#43D9FF] hover:underline pt-1"
            >
              <span>View Trust Center Profile</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
