"use client";

import { Printer, Download, ChevronRight, ShieldCheck, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import type { LegalDocInfo } from "./legal-data";

interface LegalDocumentHeaderProps {
  doc: LegalDocInfo;
}

export function LegalDocumentHeader({ doc }: LegalDocumentHeaderProps) {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="border-b border-[#1C2734] pb-8 pt-2">
      {/* Breadcrumb */}
      <nav aria-label="Legal Breadcrumb" className="mb-4 flex items-center gap-2 text-xs font-mono text-[#667383]">
        <Link href="/legal" className="hover:text-[#43D9FF] transition-colors">
          Trust & Compliance
        </Link>
        <ChevronRight className="size-3 text-[#43D9FF]/60" />
        <span className="text-[#9AA7B5] font-semibold">{doc.title}</span>
      </nav>

      {/* Category Badge & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#1C2734] bg-[#0D131C] px-3 py-1 text-xs font-mono text-[#43D9FF]">
          <span className="size-1.5 rounded-full bg-[#43D9FF] animate-pulse" />
          <span>{doc.categoryBadge}</span>
        </div>

        {/* Action Buttons: PDF & Print */}
        <div className="flex items-center gap-2.5 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1C2734] bg-[#0D131C] px-3 py-1.5 text-xs font-mono text-[#9AA7B5] hover:border-[#43D9FF]/40 hover:text-[#F5F7FA] transition-all cursor-pointer"
            title="Print or save as PDF"
          >
            <Printer className="size-3.5 text-[#43D9FF]" />
            <span>Print Document</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1C2734] bg-[#0D131C] px-3 py-1.5 text-xs font-mono text-[#9AA7B5] hover:border-[#43D9FF]/40 hover:text-[#F5F7FA] transition-all cursor-pointer"
            title="Download verified PDF"
          >
            <Download className="size-3.5 text-[#43D9FF]" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Main Document Title */}
      <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F5F7FA] font-display">
        {doc.title}
      </h1>

      {/* Lead Text */}
      <p className="mt-3 max-w-3xl text-base sm:text-lg leading-relaxed text-[#9AA7B5]">
        {doc.lead}
      </p>

      {/* Controlled Document Metadata Card */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[#1C2734] bg-[#080D14] px-4 py-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-[#9AA7B5]">
          <span className="text-[#667383]">DOCUMENT VERSION:</span>
          <span className="font-semibold text-[#F5F7FA] bg-[#111923] px-2 py-0.5 rounded border border-[#1C2734]">
            V{doc.version}.0
          </span>
        </div>
        <div className="hidden sm:block text-[#1C2734]">│</div>
        <div className="flex items-center gap-2 text-[#9AA7B5]">
          <Calendar className="size-3.5 text-[#43D9FF]" />
          <span className="text-[#667383]">EFFECTIVE:</span>
          <span className="font-medium text-[#F5F7FA]">{doc.effectiveDate}</span>
        </div>
        <div className="hidden sm:block text-[#1C2734]">│</div>
        <div className="flex items-center gap-2 text-[#9AA7B5]">
          <Clock className="size-3.5 text-[#22C55E]" />
          <span className="text-[#667383]">LAST REVIEWED:</span>
          <span className="font-medium text-[#F5F7FA]">{doc.lastUpdated}</span>
        </div>
        <div className="hidden md:block text-[#1C2734]">│</div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-[#22C55E]">
          <ShieldCheck className="size-3.5" />
          <span>Statutory Dual-Control Approved</span>
        </div>
      </div>
    </div>
  );
}
