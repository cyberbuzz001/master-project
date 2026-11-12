"use client";

import { ApiError, type ApiErrorBody, type ApiSuccess } from "./api-types";

/**
 * Browser API client. Requests go to same-origin /api (proxied to Laravel), use the
 * HttpOnly session cookie, and send the XSRF token Laravel issues via /sanctum/csrf-cookie.
 */

let csrfReady: Promise<void> | null = null;

function clearLegacyCookies(): void {
  if (typeof document === "undefined") return;
  const cookies = document.cookie.split("; ");
  for (const c of cookies) {
    const [name, val] = c.split("=");
    if ((name === "XSRF-TOKEN" || name === "esc_session") && val && !val.startsWith("eyJ")) {
      // Clear host-only legacy demo cookies
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
    }
  }
}

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  clearLegacyCookies();
  const rows = document.cookie.split("; ").filter((row) => row.startsWith(`${name}=`));
  if (rows.length === 0) return null;
  // If multiple exist (e.g. legacy host vs domain), prefer the valid encrypted Laravel token
  const bestMatch = rows.find((r) => r.includes("=eyJ")) ?? rows[rows.length - 1];
  return decodeURIComponent(bestMatch.split("=").slice(1).join("="));
}

export async function ensureCsrf(force = false): Promise<void> {
  const currentToken = readCookie("XSRF-TOKEN");
  if (!force && currentToken && currentToken.startsWith("eyJ")) return;
  if (!csrfReady || force) {
    csrfReady = fetch("/sanctum/csrf-cookie", { credentials: "include", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new ApiError(response.status, "CSRF_UNAVAILABLE", "Unable to start a secure session. Please try again later.");
      })
      .catch((error: unknown) => {
        csrfReady = null;
        throw error;
      });
  }
  await csrfReady;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(method: Method, path: string, body?: unknown, retried = false): Promise<ApiSuccess<T>> {
  if (method !== "GET") await ensureCsrf();

  const isForm = body instanceof FormData;
  const headers: Record<string, string> = { Accept: "application/json" };
  // The browser sets the multipart boundary itself, so Content-Type is only set for JSON.
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const xsrf = readCookie("XSRF-TOKEN");
  if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "We couldn't reach the server. Check your connection and try again.");
  }

  if (response.status === 419 && !retried) {
    await ensureCsrf(true);
    return request<T>(method, path, body, true);
  }

  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiErrorBody | null;

  if (!response.ok || !payload || payload.success === false) {
    const err = payload && payload.success === false ? payload : null;
    throw new ApiError(
      response.status,
      err?.error_code ?? "HTTP_ERROR",
      err?.message ?? "Something went wrong. Please try again.",
      err?.errors ?? {},
      err?.request_id,
    );
  }

  return payload;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};
