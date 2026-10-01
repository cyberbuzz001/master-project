"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "../ui";

const STORAGE_KEY = "esc.cookie-consent.v1";
const OPEN_EVENT = "esc:open-cookie-settings";
const CHANGE_EVENT = "esc:cookie-choice-changed";

export type CookieChoice = { analytics: boolean; advertising: boolean; decidedAt: string };

export function readCookieChoice(): CookieChoice | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookieChoice) : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function storedChoice(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Consent banner. Non-essential scripts (analytics, ad pixels) must check readCookieChoice()
 * before loading; none are loaded in Phase 1. Declining is as prominent as accepting.
 */
export function CookieConsent() {
  // "ssr" on the server so the banner never renders into static HTML.
  const stored = useSyncExternalStore(subscribe, storedChoice, () => "ssr");
  const [reopened, setReopened] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    const reopen = () => {
      const current = readCookieChoice();
      setAnalytics(current?.analytics ?? false);
      setAdvertising(current?.advertising ?? false);
      setReopened(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  const save = (choice: Omit<CookieChoice, "decidedAt">) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...choice, decidedAt: new Date().toISOString() }));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // Storage unavailable: the choice applies to this page view only.
    }
    setReopened(false);
    setDismissed(true);
  };

  const open = reopened || (stored === "" && !dismissed);
  if (!open) return null;

  return (
    <div role="dialog" aria-labelledby="cookie-title" className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-md">
      <div className="rounded-2xl bg-[#0D131C] p-5 shadow-2xl border border-[#1C2734] text-[#F5F7FA]">
        <p id="cookie-title" className="text-sm font-semibold text-[#F5F7FA] font-display">
          Privacy & Cookie Preferences
        </p>
        <p className="mt-1.5 text-xs leading-5 text-[#9AA7B5]">
          Necessary cookies keep the site secure and functional. Analytics cookies remain disabled unless explicitly enabled.
        </p>
        <fieldset className="mt-3 space-y-2 text-xs font-mono">
          <legend className="sr-only">Optional cookies</legend>
          <label className="flex items-center gap-2.5 text-[#9AA7B5]">
            <input type="checkbox" checked disabled className="size-3.5 rounded accent-[#43D9FF]" />
            <span>Necessary Security & Session (Always On)</span>
          </label>
          <label className="flex items-center gap-2.5 text-[#9AA7B5] cursor-pointer">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="size-3.5 rounded accent-[#43D9FF]" />
            <span>Anonymized Analytics</span>
          </label>
          <label className="flex items-center gap-2.5 text-[#9AA7B5] cursor-pointer">
            <input type="checkbox" checked={advertising} onChange={(e) => setAdvertising(e.target.checked)} className="size-3.5 rounded accent-[#43D9FF]" />
            <span>Campaign Attribution</span>
          </label>
        </fieldset>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={() => save({ analytics: false, advertising: false })}>
            Decline Optional
          </Button>
          <Button variant="primary" size="sm" onClick={() => save({ analytics, advertising })}>
            Save Choices
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsLink() {
  return (
    <button type="button" className="text-[#9AA7B5] hover:text-[#F5F7FA] transition-colors cursor-pointer" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Cookie settings
    </button>
  );
}
