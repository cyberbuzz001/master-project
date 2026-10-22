"use client";

const FIRST_TOUCH_KEY = "esc.attribution.first-touch.v2";
const LAST_TOUCH_KEY = "esc.attribution.last-touch.v2";
const TOUCH_HISTORY_KEY = "esc.attribution.touch-history.v2";

export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
] as const;

export type UtmParamKey = (typeof UTM_PARAMS)[number];

export interface AttributionTouchpoint {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  referral_code?: string;
  vendor_code?: string;
  landing_page?: string;
  referrer?: string;
  timestamp: string;
}

export type Attribution = Partial<Record<UtmParamKey | "landing_page" | "referrer" | "referral_code" | "vendor_code", string>>;

export interface MultiTouchAttribution {
  firstTouch: AttributionTouchpoint | null;
  lastTouch: AttributionTouchpoint | null;
  touchpoints: AttributionTouchpoint[];
  touchpointCount: number;
}

/**
 * Captures both first-touch and last-touch attribution across user sessions.
 * - First-touch: Persisted across days in localStorage to identify the original marketing channel.
 * - Last-touch: Stored in sessionStorage/localStorage for the most immediate converting campaign.
 */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};

  const url = new URL(window.location.href);
  const current: Partial<AttributionTouchpoint> = {};
  for (const param of UTM_PARAMS) {
    const value = url.searchParams.get(param);
    if (value) current[param] = value.slice(0, 255);
  }

  const ref = url.searchParams.get("ref") || url.searchParams.get("r");
  if (ref && /^[A-Za-z0-9_-]{1,64}$/.test(ref)) current.referral_code = ref;

  const vendor = url.searchParams.get("vendor");
  if (vendor && /^[A-Za-z0-9_-]{1,48}$/.test(vendor)) current.vendor_code = vendor;

  const hasCampaignData = Object.keys(current).length > 0;
  const now = new Date().toISOString();

  let firstTouch: AttributionTouchpoint | null = null;
  try {
    const rawFirst = window.localStorage.getItem(FIRST_TOUCH_KEY);
    firstTouch = rawFirst ? (JSON.parse(rawFirst) as AttributionTouchpoint) : null;
  } catch {
    firstTouch = null;
  }

  const currentTouchpoint: AttributionTouchpoint = {
    ...current,
    landing_page: url.toString().slice(0, 2048),
    referrer: document.referrer ? document.referrer.slice(0, 2048) : undefined,
    timestamp: now,
  };

  // If this is the visitor's first touchpoint ever, record in persistent localStorage
  if (!firstTouch) {
    firstTouch = currentTouchpoint;
    try {
      window.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
    } catch {}
  }

  // Always update last touch if campaign parameters are present, or initialize if empty
  if (hasCampaignData || !window.sessionStorage.getItem(LAST_TOUCH_KEY)) {
    try {
      window.sessionStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(currentTouchpoint));
      window.localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(currentTouchpoint));
    } catch {}
  }

  return {
    ...firstTouch,
    ...current,
    landing_page: currentTouchpoint.landing_page,
    referrer: currentTouchpoint.referrer,
  };
}

/**
 * Returns complete multi-touch attribution record for lead submission
 */
export function getMultiTouchAttribution(): MultiTouchAttribution {
  if (typeof window === "undefined") {
    return { firstTouch: null, lastTouch: null, touchpoints: [], touchpointCount: 0 };
  }

  let firstTouch: AttributionTouchpoint | null = null;
  let lastTouch: AttributionTouchpoint | null = null;

  try {
    const rawFirst = window.localStorage.getItem(FIRST_TOUCH_KEY);
    if (rawFirst) firstTouch = JSON.parse(rawFirst);
  } catch {}

  try {
    const rawLast = window.sessionStorage.getItem(LAST_TOUCH_KEY) || window.localStorage.getItem(LAST_TOUCH_KEY);
    if (rawLast) lastTouch = JSON.parse(rawLast);
  } catch {}

  const touchpoints = [firstTouch, lastTouch].filter(Boolean) as AttributionTouchpoint[];

  return {
    firstTouch,
    lastTouch: lastTouch || firstTouch,
    touchpoints,
    touchpointCount: touchpoints.length,
  };
}

export interface CampaignUrlBuilderParams {
  baseUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm?: string;
  utmContent?: string;
  refCode?: string;
}

/**
 * Helper to build campaign links with valid query parameters
 */
export function buildCampaignUrl(params: CampaignUrlBuilderParams): string {
  try {
    const url = new URL(params.baseUrl.startsWith("http") ? params.baseUrl : `https://${params.baseUrl}`);
    if (params.utmSource) url.searchParams.set("utm_source", params.utmSource);
    if (params.utmMedium) url.searchParams.set("utm_medium", params.utmMedium);
    if (params.utmCampaign) url.searchParams.set("utm_campaign", params.utmCampaign);
    if (params.utmTerm) url.searchParams.set("utm_term", params.utmTerm);
    if (params.utmContent) url.searchParams.set("utm_content", params.utmContent);
    if (params.refCode) url.searchParams.set("ref", params.refCode);
    return url.toString();
  } catch {
    return params.baseUrl;
  }
}
