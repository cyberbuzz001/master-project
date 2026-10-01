import { ArrowDown, ArrowRight, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import Link from "next/link";
import { Container, LinkButton } from "@/components/ui";
import { MarketTicker } from "@/components/site/MarketTicker";
import { HeroFinancialCore } from "@/components/site/HeroFinancialCore";
import { MarketSnapshot } from "@/components/site/MarketSnapshot";
import { IntelligenceEngine } from "@/components/site/IntelligenceEngine";
import { SimulatedResearchTerminal } from "@/components/site/SimulatedResearchTerminal";
import { ResearchProcess } from "@/components/site/ResearchProcess";
import { ServicesGrid } from "@/components/site/ServicesGrid";
import { SectorHeatmap } from "@/components/site/SectorHeatmap";
import { ResearchLibrary } from "@/components/site/ResearchLibrary";
import { TrustCenterCards } from "@/components/site/TrustCenterCards";
import { RiskFirstSection } from "@/components/site/RiskFirstSection";
import { FinancialToolsHub } from "@/components/site/FinancialToolsHub";
import { AcademySection } from "@/components/site/AcademySection";
import { ClientPortalPreview } from "@/components/site/ClientPortalPreview";
import { FinalCtaSection } from "@/components/site/FinalCtaSection";

export default function HomePage() {
  return (
    <div className="flex flex-col bg-[#05070B] text-[#F5F7FA]">
      {/* 01. Continuously Moving Market Pulse Ticker */}
      <MarketTicker />

      {/* SECTION 01 — HERO */}
      <section className="relative overflow-hidden bg-[#05070B] border-b border-[#1C2734] flex flex-col justify-center pt-8 pb-10 sm:pt-10 sm:pb-12 lg:pt-12 lg:pb-12 xl:pt-14 xl:pb-14 min-h-0 lg:min-h-[calc(100svh-128px)] lg:max-h-[800px]">
        {/* Subtle Ambient Background Tech Radial & Grid */}
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute left-1/4 top-1/4 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#43D9FF]/5 blur-[160px]" aria-hidden="true" />
        <div className="pointer-events-none absolute right-1/4 top-1/2 size-[450px] rounded-full bg-[#7C5CFF]/5 blur-[160px]" aria-hidden="true" />

        <Container className="relative z-10 grid items-center gap-8 lg:gap-12 lg:grid-cols-12 flex-1 my-auto">
          {/* Left Text Content (6 cols desktop) */}
          <div className="lg:col-span-6 space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1C2734] bg-[#0D131C] px-3.5 py-1 text-xs font-mono text-[#43D9FF]">
              <span className="size-1.5 rounded-full bg-[#43D9FF] animate-pulse" />
              <span>RESEARCH-DRIVEN MARKET INTELLIGENCE</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[64px] xl:text-[72px] font-bold tracking-tight text-[#F5F7FA] font-display leading-[0.94] text-balance">
              MARKET<br />
              INTELLIGENCE,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#43D9FF] via-[#5eead4] to-[#7C5CFF]">
                ENGINEERED.
              </span>
            </h1>

            <p className="max-w-xl text-base sm:text-lg leading-relaxed text-[#9AA7B5] text-pretty">
              Structured research, transparent methodology and risk-aware market intelligence for Indian equities and derivatives.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <LinkButton href="/research" variant="primary" size="lg">
                Explore Research
                <ArrowRight className="size-4" />
              </LinkButton>
              <LinkButton href="/login" variant="secondary" size="lg">
                Client Portal
              </LinkButton>
            </div>

            {/* Microcopy link */}
            <div className="flex items-center gap-5 pt-1 text-xs font-mono text-[#667383]">
              <Link href="/contact" className="hover:text-[#43D9FF] transition-colors flex items-center gap-1">
                <span>Talk to Our Team</span>
                <span className="text-[#43D9FF]">→</span>
              </Link>
              <span>•</span>
              <span className="text-[#9AA7B5]">Zero Unverified Claims</span>
            </div>
          </div>

          {/* Right 3D Three.js Visualization Core (6 cols desktop) */}
          <div className="lg:col-span-6 flex items-center justify-center relative min-h-[280px] sm:min-h-[360px] md:min-h-[420px] lg:min-h-[460px] xl:min-h-[500px]">
            <HeroFinancialCore />
          </div>
        </Container>

        {/* Compact Scroll Indicator */}
        <div className="relative z-10 hidden sm:flex flex-col items-center justify-center pt-2 sm:pt-4 text-xs font-mono text-[#667383]">
          <span className="mb-1 text-[11px] tracking-wider text-[#667383]/80">Scroll to explore</span>
          <ArrowDown className="size-3 animate-bounce text-[#43D9FF]" />
        </div>
      </section>

      {/* SECTION 02 — MARKET SNAPSHOT */}
      <MarketSnapshot />

      {/* SECTION 03 — THE INTELLIGENCE ENGINE */}
      <IntelligenceEngine />

      {/* SECTION 04 — LIVE RESEARCH TERMINAL */}
      <SimulatedResearchTerminal />

      {/* SECTION 05 — RESEARCH PROCESS */}
      <ResearchProcess />

      {/* SECTION 06 — SERVICES */}
      <ServicesGrid />

      {/* SECTION 07 — SECTOR PULSE (HEATMAP) */}
      <SectorHeatmap />

      {/* SECTION 08 — MARKET RESEARCH LIBRARY */}
      <ResearchLibrary />

      {/* SECTION 09 — TRUST CENTER */}
      <TrustCenterCards />

      {/* SECTION 10 — RISK FIRST */}
      <RiskFirstSection />

      {/* SECTION 11 — FINANCIAL TOOLS HUB */}
      <FinancialToolsHub />

      {/* SECTION 12 — EXPERT STOCKS ACADEMY */}
      <AcademySection />

      {/* SECTION 13 — CLIENT PORTAL PREVIEW */}
      <ClientPortalPreview />

      {/* SECTION 14 — FINAL CTA */}
      <FinalCtaSection />
    </div>
  );
}
