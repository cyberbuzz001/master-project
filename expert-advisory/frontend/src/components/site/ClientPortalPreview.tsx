"use client";

import { ArrowRight, Bell, FileText, LayoutDashboard, LineChart, ShieldCheck, UserCheck, Wallet, Lock, Layers } from "lucide-react";
import Link from "next/link";
import { Container, Eyebrow, LinkButton } from "../ui";

export function ClientPortalPreview() {
  return (
    <section className="relative py-24 lg:py-32 bg-[#05070B] border-b border-[#1C2734]">
      <Container>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-16">
          <div>
            <Eyebrow className="mb-3">Secure Workspace</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-bold font-display text-[#F5F7FA] tracking-tight">
              Your research. One secure workspace.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9AA7B5] max-w-2xl leading-relaxed">
              Every client receives a centralized dashboard to track active research reports, risk profiling records, subscription agreements, and verified regulatory notices.
            </p>
          </div>
          <LinkButton href="/login" variant="primary" size="md">
            Enter Client Workspace
            <ArrowRight className="size-4" />
          </LinkButton>
        </div>

        {/* Dashboard Mockup Frame */}
        <div className="rounded-2xl border border-[#1C2734] bg-[#0D131C] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden">
          {/* Top Window Bar */}
          <div className="flex items-center justify-between border-b border-[#1C2734] bg-[#080D14] px-4 py-2.5 text-xs font-mono text-[#667383]">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#F05252]/80" />
              <span className="size-2.5 rounded-full bg-[#F5B84B]/80" />
              <span className="size-2.5 rounded-full bg-[#22C55E]/80" />
              <span className="ml-2 font-bold text-[#F5F7FA]">client.expertstocks.in // portal</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[#22C55E]">
                <ShieldCheck className="size-3.5" /> 256-Bit SSL Encrypted
              </span>
            </div>
          </div>

          {/* Main Dashboard Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
            {/* Sidebar Navigation (3 cols) */}
            <div className="lg:col-span-3 border-r border-[#1C2734] bg-[#080D14] p-4 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center gap-2 px-2 pt-2">
                  <div className="size-2 rounded-full bg-[#43D9FF]" />
                  <span className="font-mono text-xs font-bold text-[#F5F7FA] tracking-wider uppercase">
                    CLIENT PORTAL
                  </span>
                </div>

                <nav className="space-y-1">
                  {[
                    { label: "Dashboard Overview", icon: LayoutDashboard, active: true },
                    { label: "Market Research Feed", icon: LineChart, badge: "3 New" },
                    { label: "Watchlist & Alerts", icon: Bell },
                    { label: "Advisory Plans & Reports", icon: Layers },
                    { label: "Compliance & Risk Profile", icon: ShieldCheck, verified: true },
                    { label: "Agreements & Invoices", icon: FileText },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-sans font-medium transition-colors ${
                          item.active
                            ? "bg-[#111923] text-[#43D9FF] border border-[#1C2734]"
                            : "text-[#9AA7B5] hover:bg-[#111923]/50 hover:text-[#F5F7FA]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[10px] font-mono bg-[#43D9FF]/15 text-[#43D9FF] px-1.5 py-0.5 rounded">
                            {item.badge}
                          </span>
                        )}
                        {item.verified && (
                          <span className="text-[10px] font-mono text-[#22C55E]">✓</span>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </div>

              {/* Bottom User Card */}
              <div className="mt-8 rounded-xl border border-[#1C2734] bg-[#111923] p-3 text-xs font-mono">
                <div className="text-[10px] text-[#667383]">ACTIVE CLIENT</div>
                <div className="font-bold text-[#F5F7FA] mt-0.5">Siddharth Rao</div>
                <div className="text-[10px] text-[#43D9FF] mt-0.5">ID: ES-IND-9042</div>
              </div>
            </div>

            {/* Main Area (9 cols) */}
            <div className="lg:col-span-9 p-6 lg:p-8 space-y-6 bg-[#05070B]">
              {/* Top Client Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1C2734]">
                <div>
                  <h3 className="text-lg font-bold font-display text-[#F5F7FA]">
                    Market Intelligence Workspace
                  </h3>
                  <div className="text-xs font-mono text-[#9AA7B5] mt-0.5">
                    Tier: Professional Derivative Research · Expiry: 31 Dec 2026
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 px-3 py-1 text-xs font-mono text-[#22C55E]">
                    <span className="size-1.5 rounded-full bg-[#22C55E]" />
                    Risk Assessment: Completed
                  </span>
                </div>
              </div>

              {/* Live Indices Bar in Dashboard */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-3.5">
                  <div className="text-[#667383] text-[10px]">NIFTY 50</div>
                  <div className="text-base font-bold text-[#F5F7FA] mt-1 flex items-center justify-between">
                    <span>25,418.50</span>
                    <span className="text-[#22C55E] text-xs font-normal">+0.64%</span>
                  </div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-3.5">
                  <div className="text-[#667383] text-[10px]">BANK NIFTY</div>
                  <div className="text-base font-bold text-[#F5F7FA] mt-1 flex items-center justify-between">
                    <span>53,890.15</span>
                    <span className="text-[#22C55E] text-xs font-normal">+0.72%</span>
                  </div>
                </div>
                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-3.5">
                  <div className="text-[#667383] text-[10px]">INDIA VIX</div>
                  <div className="text-base font-bold text-[#F5F7FA] mt-1 flex items-center justify-between">
                    <span>12.42</span>
                    <span className="text-[#22C55E] text-xs font-normal">-3.25%</span>
                  </div>
                </div>
              </div>

              {/* Active Research Alerts Feed */}
              <div className="space-y-3">
                <div className="text-xs font-mono font-semibold text-[#9AA7B5] uppercase tracking-wider">
                  ACTIVE RESEARCH RECOMMENDATIONS
                </div>

                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#43D9FF] bg-[#43D9FF]/10 px-2 py-0.5 rounded">
                        NIFTY 25500 CE
                      </span>
                      <span className="text-xs font-mono text-[#667383]">Weekly Expiry</span>
                    </div>
                    <div className="text-xs text-[#F5F7FA] font-medium">
                      Call spread architecture · Entry: ₹85 | Target: ₹130 | Invalidation: ₹58
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono text-[#22C55E] font-semibold bg-[#22C55E]/10 px-2.5 py-1 rounded border border-[#22C55E]/20">
                      R:R 1 : 2.6
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-[#1C2734] bg-[#0D131C] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#7C5CFF] bg-[#7C5CFF]/10 px-2 py-0.5 rounded">
                        HDFCBANK
                      </span>
                      <span className="text-xs font-mono text-[#667383]">Cash Swing Horizon</span>
                    </div>
                    <div className="text-xs text-[#F5F7FA] font-medium">
                      Multi-month breakout setup · Entry: ₹1,640 | Target: ₹1,780 | Invalidation: ₹1,585
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono text-[#22C55E] font-semibold bg-[#22C55E]/10 px-2.5 py-1 rounded border border-[#22C55E]/20">
                      R:R 1 : 2.5
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Compliance Status Strip */}
              <div className="rounded-xl bg-[#111923] p-4 border border-[#1C2734] flex items-center justify-between text-xs font-mono text-[#667383]">
                <span>SEBI Risk Agreement: Signed (v2.4.1)</span>
                <span className="text-[#43D9FF]">Download Signed Dossier (PDF) →</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
