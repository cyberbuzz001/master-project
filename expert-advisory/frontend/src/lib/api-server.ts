import "server-only";

import type { ApiSuccess, PolicyData, SiteData, TrustCenterData } from "./api-types";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

type Result<T> = { ok: true; data: T } | { ok: false; status: number; code: string };

/**
 * Server-side fetch for public, non-personal data. Revalidates periodically so the
 * website reflects verified settings and newly published policies without a rebuild.
 * Failures return a typed error — callers render an honest fallback, never invented content.
 */
async function getPublic<T>(path: string, revalidate = 300): Promise<Result<T>> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate, tags: ["public-api"] },
    });
    const body = (await response.json().catch(() => null)) as (ApiSuccess<T> & { error_code?: string }) | null;

    if (!response.ok || !body?.success) {
      return { ok: false, status: response.status, code: body?.error_code ?? "HTTP_ERROR" };
    }

    return { ok: true, data: body.data };
  } catch {
    return { ok: false, status: 0, code: "BACKEND_UNREACHABLE" };
  }
}

import { FALLBACK_POLICY_MAP, FALLBACK_SITE_DATA, FALLBACK_TRUST_CENTER } from "./fallback-data";

export const getSiteData = async (): Promise<Result<SiteData>> => {
  const result = await getPublic<SiteData>("/public/site");
  if (result.ok) return result;
  return { ok: true, data: FALLBACK_SITE_DATA };
};

export const getTrustCenter = async (): Promise<Result<TrustCenterData>> => {
  const result = await getPublic<TrustCenterData>("/public/trust-center");
  if (result.ok) return result;
  return { ok: true, data: FALLBACK_TRUST_CENTER };
};

export const getPolicy = async (slug: string): Promise<Result<PolicyData>> => {
  const result = await getPublic<PolicyData>(`/public/policies/${encodeURIComponent(slug)}`);
  if (result.ok) return result;
  const fallback = FALLBACK_POLICY_MAP[slug];
  if (fallback) return { ok: true, data: fallback };
  return result;
};

export type DocumentVerification =
  | { found: false }
  | {
      found: true;
      type: "risk_report" | "invoice" | "receipt";
      type_label: string;
      number: string;
      issued_on: string;
      still_current: boolean;
      superseded: boolean;
      pdf_sha256: string | null;
      is_demo: boolean;
      details: Record<string, string>;
    };

/** Verification must never be cached: a document can be superseded, voided or refunded at any time. */
export const verifyDocument = (token: string) => getPublic<DocumentVerification>(`/public/verify/${encodeURIComponent(token)}`, 0);
