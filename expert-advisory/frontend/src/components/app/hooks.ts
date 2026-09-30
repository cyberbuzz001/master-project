"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/api-types";

export type Loadable<T> = {
  data: T | null;
  meta: Record<string, unknown> | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
};

type Settled<T> = { key: string; data: T | null; meta?: Record<string, unknown>; error: ApiError | null };

/**
 * GET a resource; re-fetches when the path changes or reload() is called.
 * `loading` is derived from whether the latest request has settled, so previous data stays visible while refreshing.
 */
export function useApiGet<T>(path: string | null): Loadable<T> {
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ key: "", data: null, error: null });
  const requestKey = path === null ? "" : `${path}#${tick}`;

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    api
      .get<T>(path)
      .then((res) => {
        if (!cancelled) setSettled({ key: requestKey, data: res.data, meta: res.meta, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSettled({ key: requestKey, data: null, error: err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "Unexpected error") });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, requestKey]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return {
    data: settled.data,
    meta: settled.meta,
    error: settled.key === requestKey ? settled.error : null,
    loading: path !== null && settled.key !== requestKey,
    reload,
  };
}

/** Returns true once when `value` changes between renders (render-phase state update, per React guidance). */
export function useChanged<T>(value: T): boolean {
  const [previous, setPrevious] = useState(value);
  if (previous !== value) {
    setPrevious(value);
    return true;
  }
  return false;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
}

export function humanize(value: string): string {
  return value.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
