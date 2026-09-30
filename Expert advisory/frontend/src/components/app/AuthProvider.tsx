"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { ApiError, type Me } from "@/lib/api-types";

type AuthContextValue = {
  me: Me;
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** Paths served by Laravel rather than Next.js need a full page load. */
export function isServerRoute(path: string): boolean {
  return path === "/office" || path.startsWith("/office/") || path.startsWith("/office?");
}

/** Route a signed-in user to the most appropriate area. */
export function homeFor(me: Me): string {
  if (me.two_factor.enrollment_required) return "/account/security?setup=2fa";
  // Staff work in the Filament back-office served by Laravel at /office.
  if (me.user_type === "staff" && me.areas.some((a) => a !== "portal")) return "/office";
  if (me.areas.includes("portal")) return "/portal";
  return "/account/security";
}

/**
 * Loads the current user for the authenticated app. The API re-checks every permission;
 * this provider only decides what to render and where to redirect.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(
    () =>
      api
        .get<Me>("/me")
        .then((res) => {
          setMe(res.data);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && (err.status === 401 || err.code === "ACCOUNT_INACTIVE")) {
            router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          setError(err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "Unexpected error"));
        }),
    [router],
  );

  useEffect(() => {
    // Load once on mount; later refreshes are triggered explicitly via refresh().
    api
      .get<Me>("/me")
      .then((res) => setMe(res.data))
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.status === 401 || err.code === "ACCOUNT_INACTIVE")) {
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        setError(err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "Unexpected error"));
      });
  }, [router]);

  useEffect(() => {
    if (me?.two_factor.enrollment_required && !pathname.startsWith("/account/security")) {
      router.replace("/account/security?setup=2fa");
    }
  }, [me, pathname, router]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="text-base font-semibold text-ink-900">We couldn&apos;t load your account</p>
          <p className="mt-1 text-sm text-ink-600">{error.message}</p>
          <button type="button" onClick={() => void load()} className="mt-4 text-sm font-semibold text-brand-700">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center" role="status" aria-label="Loading">
        <Loader2 className="size-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ me, can: (p) => me.permissions.includes(p), refresh: load, logout }}>{children}</AuthContext.Provider>
  );
}
