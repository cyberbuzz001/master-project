"use client";

import { useState, useEffect } from "react";
import { Cookie, Shield, Activity, Sliders, CheckCircle2, Lock } from "lucide-react";

export function CookiePolicyView() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [savedNotification, setSavedNotification] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("expert_cookie_analytics");
      if (saved !== null) {
        setAnalyticsEnabled(saved === "true");
      }
    }
  }, []);

  const handleSavePreferences = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("expert_cookie_analytics", String(analyticsEnabled));
      setSavedNotification(true);
      setTimeout(() => setSavedNotification(false), 3000);
    }
  };

  return (
    <div className="space-y-10 text-[#F5F7FA]">
      {/* Interactive Cookie Settings Dashboard */}
      <div className="rounded-2xl border-2 border-[#43D9FF]/30 bg-[#0B141D] p-6 sm:p-8 shadow-[0_0_30px_rgba(67,217,255,0.06)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#43D9FF]/15 border border-[#43D9FF]/30 flex items-center justify-center text-[#43D9FF]">
              <Sliders className="size-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-[#F5F7FA]">
                Cookie Preferences Control Panel
              </h2>
              <p className="text-xs text-[#9AA7B5]">
                Adjust and save your telemetry preferences below in real time.
              </p>
            </div>
          </div>

          {savedNotification && (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 px-3 py-1 text-xs font-mono text-[#22C55E] animate-fade-in">
              <CheckCircle2 className="size-3.5" />
              <span>Preferences Saved</span>
            </div>
          )}
        </div>

        <div className="space-y-3 mt-6">
          {/* Essential Cookies (Always On) */}
          <div className="flex items-center justify-between rounded-xl border border-[#1C2734] bg-[#080D14] p-4">
            <div className="flex items-start gap-3">
              <Lock className="size-4 text-[#22C55E] mt-0.5" />
              <div>
                <div className="text-sm font-semibold font-mono text-[#F5F7FA] flex items-center gap-2">
                  <span>Essential System Cookies</span>
                  <span className="text-[10px] uppercase font-bold text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded border border-[#22C55E]/20">
                    Always Active
                  </span>
                </div>
                <p className="text-xs text-[#9AA7B5] mt-0.5">
                  Required for core platform security, sign-in sessions, and CSRF token verification. Cannot be disabled.
                </p>
              </div>
            </div>

            <div className="px-3 py-1 rounded bg-[#162130] text-xs font-mono font-bold text-[#22C55E] border border-[#1C2734]">
              ON
            </div>
          </div>

          {/* Analytics Cookies (Toggleable) */}
          <div className="flex items-center justify-between rounded-xl border border-[#1C2734] bg-[#080D14] p-4">
            <div className="flex items-start gap-3">
              <Activity className="size-4 text-[#43D9FF] mt-0.5" />
              <div>
                <div className="text-sm font-semibold font-mono text-[#F5F7FA] flex items-center gap-2">
                  <span>Analytical & Performance Cookies</span>
                  <span className="text-[10px] uppercase font-bold text-[#43D9FF] bg-[#43D9FF]/10 px-2 py-0.5 rounded border border-[#43D9FF]/20">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-[#9AA7B5] mt-0.5">
                  Aggregated, privacy-preserving performance telemetry to analyze page load speeds and visitor navigation.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                analyticsEnabled ? "bg-[#43D9FF]" : "bg-[#1C2734]"
              }`}
              role="switch"
              aria-checked={analyticsEnabled}
              aria-label="Toggle Analytical Cookies"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-[#05070B] shadow ring-0 transition duration-200 ease-in-out ${
                  analyticsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleSavePreferences}
            className="rounded-lg bg-[#43D9FF] px-4 py-2 text-xs font-semibold text-[#05070B] hover:bg-[#33c9ef] transition-colors cursor-pointer"
          >
            Save Cookie Preferences
          </button>
        </div>
      </div>

      {/* SECTION 01: Essential Cookies Detail */}
      <section id="essential-cookies" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            01
          </span>
          <span className="uppercase tracking-widest">Platform Infrastructure</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          1. Essential Cookies
        </h3>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
          <p>
            These cookies are strictly necessary for the fundamental operation of our website and client portal:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
            <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
              <div className="font-semibold text-[#F5F7FA] mb-1">Session Authentication</div>
              <p className="text-[#9AA7B5]">
                Maintains your authenticated session while navigating between research publications and client portal modules.
              </p>
            </div>
            <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
              <div className="font-semibold text-[#F5F7FA] mb-1">CSRF Security Tokens</div>
              <p className="text-[#9AA7B5]">
                Protects against Cross-Site Request Forgery attacks when submitting forms or updating risk profiling answers.
              </p>
            </div>
            <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4">
              <div className="font-semibold text-[#F5F7FA] mb-1">Consent Flags</div>
              <p className="text-[#9AA7B5]">
                Stores your privacy and cookie consent choices so you are not repeatedly prompted on returning visits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 02: Analytical & Performance Cookies */}
      <section id="analytical-cookies" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            02
          </span>
          <span className="uppercase tracking-widest">Performance Insights</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          2. Analytical & Performance Cookies
        </h3>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
          <p>
            With your affirmative consent, we utilize privacy-focused analytical cookies to understand how visitors engage with our educational resources, which market insights receive high engagement, and how to improve site speed and client portal responsiveness.
          </p>
          <div className="rounded-xl border border-[#1C2734] bg-[#101923] p-4 text-xs font-mono text-[#9AA7B5]">
            We do NOT sell analytical telemetry to third-party ad brokers or employ invasive cross-site tracking cookies.
          </div>
        </div>
      </section>

      {/* SECTION 03: Managing Cookie Preferences */}
      <section id="managing-cookies" className="rounded-2xl border border-[#1C2734] bg-[#0B111A] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[#43D9FF] mb-3">
          <span className="size-6 rounded-md bg-[#111923] border border-[#1C2734] flex items-center justify-center font-bold">
            03
          </span>
          <span className="uppercase tracking-widest">Browser Level Control</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          3. Managing Cookie Preferences
        </h3>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#9AA7B5]">
          <p>
            You can review or adjust your cookie preferences at any time using the interactive control panel at the top of this page, through the &quot;Cookie Settings&quot; footer link, or by adjusting privacy settings in your web browser.
          </p>
        </div>
      </section>
    </div>
  );
}
