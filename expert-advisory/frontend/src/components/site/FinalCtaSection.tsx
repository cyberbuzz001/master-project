"use client";

import { ArrowRight, MessageSquareCode } from "lucide-react";
import { Container, LinkButton } from "../ui";

export function FinalCtaSection() {
  return (
    <section className="relative py-16 lg:py-24 bg-[#05070B] border-b border-[#1C2734] overflow-hidden">
      {/* Background Subtle Tech Radial Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-[#43D9FF]/5 blur-[150px]" />

      <Container className="relative z-10 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#1C2734] bg-[#0D131C] px-3.5 py-1 text-xs font-mono text-[#43D9FF] mb-8">
          <span className="size-1.5 rounded-full bg-[#43D9FF]" />
          <span>RESEARCH-FIRST ADVISORY</span>
        </div>

        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold font-display text-[#F5F7FA] tracking-tight text-balance leading-tight">
          Understand the market.<br />
          Manage the risk.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#43D9FF] to-[#7C5CFF]">
            Research with discipline.
          </span>
        </h2>

        <p className="mt-6 text-base sm:text-lg text-[#9AA7B5] max-w-2xl mx-auto leading-relaxed text-pretty">
          Replace speculation with structured quantitative frameworks, transparent invalidation stops, and human-reviewed market intelligence.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <LinkButton href="/research" variant="primary" size="lg">
            Explore Research Archive
            <ArrowRight className="size-4" />
          </LinkButton>
          <LinkButton href="/contact" variant="secondary" size="lg">
            <MessageSquareCode className="size-4" />
            Talk to Our Team
          </LinkButton>
        </div>

        <div className="mt-8 text-xs font-mono text-[#667383]">
          Zero unverified return claims · Strict SEBI conflict-of-interest policies enforced
        </div>
      </Container>
    </section>
  );
}
