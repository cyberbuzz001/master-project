"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { homeFor, isServerRoute } from "@/components/app/AuthProvider";
import { Button, Field, Input, Notice } from "@/components/ui";
import { api } from "@/lib/api-client";
import { ApiError, type Me } from "@/lib/api-types";

/** Only same-site relative paths are accepted as post-login destinations. */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"credentials" | "two-factor">("credentials");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);

  function finish(me: Me) {
    const next = safeNext(params.get("next"));
    const target = me.two_factor.enrollment_required ? homeFor(me) : (next ?? homeFor(me));
    if (isServerRoute(target)) {
      window.location.assign(target);
    } else {
      router.replace(target);
    }
  }

  function describe(err: unknown): string {
    if (!(err instanceof ApiError)) return "Something went wrong. Please try again.";
    if (err.code === "RATE_LIMITED") return "Too many attempts. Please wait a minute before trying again.";
    return err.message;
  }

  async function submitCredentials(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ two_factor_required: boolean; user?: Me }>("/auth/login", {
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        remember: form.get("remember") === "on",
      });
      if (res.data.two_factor_required) {
        setStep("two-factor");
        setBusy(false);
      } else if (res.data.user) {
        finish(res.data.user);
      }
    } catch (err) {
      setError(describe(err));
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ user: Me }>("/auth/two-factor/challenge", { code });
      finish(res.data.user);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "TWO_FACTOR_SESSION_EXPIRED" || err.code === "ACCOUNT_LOCKED")) {
        setStep("credentials");
      }
      setError(describe(err));
      setBusy(false);
    }
  }

  if (step === "two-factor") {
    return (
      <form onSubmit={submitCode} className="space-y-5" noValidate>
        <div className="flex items-start gap-3 rounded-xl bg-brand-50 p-4 ring-1 ring-brand-100">
          <ShieldCheck className="mt-0.5 size-5 text-brand-600" aria-hidden="true" />
          <p className="text-sm leading-6 text-brand-900">
            {useRecovery ? "Enter one of your saved recovery codes." : "Enter the 6-digit code from your authenticator app."}
          </p>
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label={useRecovery ? "Recovery code" : "Authentication code"} htmlFor="code">
          <Input
            id="code"
            name="code"
            autoComplete="one-time-code"
            inputMode={useRecovery ? "text" : "numeric"}
            pattern={useRecovery ? undefined : "[0-9]{6}"}
            maxLength={useRecovery ? 11 : 6}
            className="font-mono tracking-[0.3em]"
            autoFocus
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Verify
        </Button>
        <button type="button" className="w-full text-center text-sm font-medium text-brand-700" onClick={() => setUseRecovery((v) => !v)}>
          {useRecovery ? "Use authenticator code instead" : "Use a recovery code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCredentials} className="space-y-5" noValidate>
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="remember" className="size-4 accent-brand-600" /> Keep me signed in on this device
      </label>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Sign in
      </Button>
    </form>
  );
}
