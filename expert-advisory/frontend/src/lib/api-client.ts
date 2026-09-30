"use client";

import { ApiError, type ApiErrorBody, type ApiSuccess } from "./api-types";

/**
 * Browser API client. Requests go to same-origin /api (proxied to Laravel), use the
 * HttpOnly session cookie, and send the XSRF token Laravel issues via /sanctum/csrf-cookie.
 */

let csrfReady: Promise<void> | null = null;

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

async function ensureCsrf(force = false): Promise<void> {
  if (!force && readCookie("XSRF-TOKEN")) return;
  if (!csrfReady || force) {
    csrfReady = fetch("/sanctum/csrf-cookie", { credentials: "include" }).then(() => undefined);
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
