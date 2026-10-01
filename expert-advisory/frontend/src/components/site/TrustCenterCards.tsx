"use client";

import { ArrowRight, Download, FileText, Scale, ShieldCheck, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { Container, Eyebrow, LinkButton } from "../ui";
import { TRUST_CONFIG } from "@/lib/trust-config";

export function TrustCenterCards() {
  const cards = [
    {
      id: "methodology",
      title: "RESEARCH METHODOLOGY",
      version: TRUST_CONFIG.documents[0].version,
      updated: TRUST_CONFIG.documents[0].lastUpdated,
      desc: "Deterministic framework combining multi-timeframe price action, liquidity sweeps, and balance-sheet solvency ratios.",
      icon: FileText,
      href: "/methodology",
      action: "Read Methodology",
    },
    {
      id: "disclosures",
      title: "DISCLOSURES & CONFLICTS",
      version: TRUST_CONFIG.documents[1].version,
      updated: TRUST_CONFIG.documents[1].lastUpdated,
      desc: "Mandatory personal trading blackout windows for analysts (T-30 to T+5), proprietary holding disclosures, and compensation rules.",
      icon: Scale,
      href: "/trust-center#disclosures",
      action: "Inspect Policy",
    },
    {
      id: "governance",
      title: "GOVERNANCE & STANDARDS",
      version: TRUST_CONFIG.documents[2].version,
      updated: TRUST_CONFIG.documents[2].lastUpdated,
      desc: "Dual-control research sign-offs, statutory boundaries, and transparent communication protocols aligned with market regulations.",
      icon: ShieldCheck,
      href: "/trust-center#governance",
      action: "Review Standards",
    },
    {
      id: "grievance",
      title: "GRIEVANCE REDRESSAL",
      version: TRUST_CONFIG.documents[3].version,
      updated: TRUST_CONFIG.documents[3].lastUpdated,
      desc: "Formal investor charter, designated compliance officer escalation matrix, and direct integration with SEBI SCORES & SMART ODR portals.",
      icon: LifeBuoy,
      href: "/legal/grievance-redressal",
      action: "Escalation Matrix",
    },
  ];

  return (
    <section id="trust-center" className="relative py-16 lg:py-24 bg-[#05070B] border-b border-[#1C2734]">
      <Container>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-16">
          <div>
            <Eyebrow className="mb-3">Transparency & Governance</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight text-balance">
              Transparency is part of the product.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] max-w-2xl leading-relaxed text-pretty">
              We believe trust is earned through verifiable methodology, clear conflict-of-interest declarations, and accessible compliance escalation channels.
            </p>
          </div>
          <LinkButton href="/trust-center" variant="secondary" size="md">
            View Complete Trust Center
            <ArrowRight className="size-4" />
          </LinkButton>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.id}
                className="group flex flex-col justify-between rounded-2xl border border-[#1C2734] bg-[#0D131C] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-[#283749] hover:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.8)]"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="grid size-10 place-items-center rounded-lg border border-[#1C2734] bg-[#111923] text-[#43D9FF] group-hover:scale-105 transition-transform">
                      <Icon className="size-5" />
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-[#43D9FF] bg-[#43D9FF]/10 px-2 py-0.5 rounded border border-[#43D9FF]/20">
                      {card.version}
                    </span>
                  </div>

                  <h3 className="text-base font-bold font-display text-[#F5F7FA] tracking-tight">
                    {card.title}
                  </h3>

                  <p className="mt-3 text-xs leading-relaxed text-[#9AA7B5]">
                    {card.desc}
                  </p>

                  <div className="mt-6 text-[10px] font-mono text-[#667383] pt-3 border-t border-[#1C2734]">
                    Last Verified: {card.updated}
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    href={card.href}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F5F7FA] group-hover:text-[#43D9FF] transition-colors"
                  >
                    <span>{card.action}</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Central Compliance Strip */}
        <div className="mt-12 rounded-xl border border-[#1C2734] bg-[#080D14] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[#22C55E]" />
            </span>
            <div className="text-xs text-[#9AA7B5] font-sans">
              <span className="font-semibold text-[#F5F7FA]">Investor Grievance Cell: </span>
              {TRUST_CONFIG.grievanceOfficer.email} · {TRUST_CONFIG.grievanceOfficer.escalationTimeline}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <a
              href={TRUST_CONFIG.grievanceOfficer.scoresUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#43D9FF] hover:underline"
            >
              SEBI SCORES →
            </a>
            <span className="text-[#1C2734]">│</span>
            <a
              href={TRUST_CONFIG.grievanceOfficer.smartOdrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#43D9FF] hover:underline"
            >
              SMART ODR →
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
