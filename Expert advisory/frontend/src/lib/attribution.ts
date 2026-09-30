"use client";

const KEY = "esc.attribution.first-touch.v1";
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"] as const;

export type Attribution = Partial<Record<(typeof PARAMS)[number] | "landing_page" | "referrer" | "referral_code" | "vendor_code", string>>;

/**
 * Captures first-touch attribution for the browsing session so a lead submitted on a later
 * page keeps the campaign that brought the visitor in.
 */
export function captureAttribution(): Attribution {
  let stored: Attribution | null = null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    stored = raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    stored = null;
  }

  const url = new URL(window.location.href);
  const current: Attribution = {};
  for (const param of PARAMS) {
    const value = url.searchParams.get(param);
    if (value) current[param] = value.slice(0, 255);
  }
  const ref = url.searchParams.get("ref");
  if (ref && /^[A-Za-z0-9_-]{1,64}$/.test(ref)) current.referral_code = ref;
  const vendor = url.searchParams.get("vendor");
  if (vendor && /^[A-Za-z0-9_-]{1,48}$/.test(vendor)) current.vendor_code = vendor;

  const hasCampaignData = Object.keys(current).length > 0;

  if (stored && !hasCampaignData) return stored;

  const attribution: Attribution = {
    ...current,
    landing_page: url.toString().slice(0, 2048),
    referrer: document.referrer ? document.referrer.slice(0, 2048) : undefined,
  };

  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(attribution));
  } catch {
    // Storage unavailable: attribution still applies to this page.
  }

  return attribution;
}
