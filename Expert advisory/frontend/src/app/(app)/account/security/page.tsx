"use client";

import { Copy, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { homeFor, useAuth } from "@/components/app/AuthProvider";
import { formatDateTime, useApiGet } from "@/components/app/hooks";
import { StatusBadge, Table, EmptyRow } from "@/components/app/widgets";
import { LogoMark } from "@/components/site/Logo";
import { Badge, Button, Card, Field, Input, Notice } from "@/components/ui";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/api-types";

type Enrollment = { secret: string; otpauth_url: string; qr_svg: string };
type SessionRow = { id: string; ip_address: string | null; user_agent: string | null; last_active_at: string; is_current: boolean };
type LoginRow = { outcome: string; ip: string | null; user_agent: string | null; created_at: string };

export default function SecurityPage() {
  const { me, refresh, logout } = useAuth();

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <a href={homeFor(me)} className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <LogoMark className="size-6" /> Account security
          </a>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">{me.name}</h1>
          <p className="text-sm text-ink-600">
            {me.email} · {me.roles.map((r) => r.label).join(", ")}
          </p>
        </div>
        <TwoFactorCard onChange={refresh} />
        <PasswordCard />
        <SessionsCard />
        <LoginHistoryCard />
      </main>
    </div>
  );
}

function TwoFactorCard({ onChange }: { onChange: () => Promise<void> }) {
  const { me } = useAuth();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      setEnrollment((await api.post<Enrollment>("/me/two-factor")).data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start setup.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ recovery_codes: string[] }>("/me/two-factor/confirm", { code });
      setCodes(res.data.recovery_codes);
      setEnrollment(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  if (codes) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-positive-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink-950">Two-factor authentication is on</h2>
        </div>
        <Notice tone="warning" className="mt-4" title="Save your recovery codes now">
          Each code works once if you lose access to your authenticator. They won&apos;t be shown again.
        </Notice>
        <ul className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-ink-50 p-4 font-mono text-sm sm:grid-cols-4">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard.writeText(codes.join("\n"))}>
            <Copy className="size-4" aria-hidden="true" /> Copy codes
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              setCodes(null);
              await onChange();
            }}
          >
            I&apos;ve saved them — continue
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {me.two_factor.enabled ? <ShieldCheck className="size-5 text-positive-600" aria-hidden="true" /> : <ShieldAlert className="size-5 text-warning-700" aria-hidden="true" />}
          <h2 className="text-lg font-semibold text-ink-950">Two-factor authentication</h2>
        </div>
        {me.two_factor.enabled ? <Badge tone="positive">On</Badge> : me.two_factor.required ? <Badge tone="warning">Required for your role</Badge> : <Badge>Off</Badge>}
      </div>

      {me.two_factor.enrollment_required && !enrollment && (
        <Notice tone="warning" className="mt-4">
          Your role requires two-factor authentication. Set it up to continue to your workspace.
        </Notice>
      )}
      {error && <Notice tone="danger" className="mt-4">{error}</Notice>}

      {!me.two_factor.enabled && !enrollment && (
        <div className="mt-4">
          <p className="text-sm leading-6 text-ink-600">Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.</p>
          <Button className="mt-4" onClick={() => void begin()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Set up two-factor authentication
          </Button>
        </div>
      )}

      {enrollment && (
        <div className="mt-5 grid gap-6 sm:grid-cols-[220px_1fr]">
          {/* QR SVG is generated server-side from the user's own secret. */}
          <div className="rounded-xl bg-white p-2 ring-1 ring-ink-200" dangerouslySetInnerHTML={{ __html: enrollment.qr_svg }} />
          <div>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-700">
              <li>Scan the QR code with your authenticator app.</li>
              <li>
                Or enter this key manually: <code className="break-all rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">{enrollment.secret}</code>
              </li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <form onSubmit={confirm} className="mt-4 flex flex-wrap items-end gap-2">
              <Field label="Code" htmlFor="totp">
                <Input id="totp" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" className="w-36 font-mono tracking-[0.3em]" required />
              </Field>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Verify & enable
              </Button>
            </form>
          </div>
        </div>
      )}

      {me.two_factor.enabled && (
        <p className="mt-3 text-sm text-ink-600">
          {me.two_factor.verified_this_session ? "Verified for this session." : "You'll be asked for a code each time you sign in."}
        </p>
      )}
    </Card>
  );
}

function PasswordCard() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "brand"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const res = await api.put<{ other_sessions_revoked: number }>("/me/password", {
        current_password: form.get("current_password"),
        password: form.get("password"),
        password_confirmation: form.get("password_confirmation"),
      });
      formEl.reset();
      setMessage({ tone: "brand", text: `Password updated. ${res.data.other_sessions_revoked} other session(s) were signed out.` });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setMessage({ tone: "danger", text: err.message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-ink-950">Password</h2>
      <p className="mt-1 text-sm text-ink-600">At least 12 characters with upper- and lower-case letters, a number and a symbol.</p>
      {message && <Notice tone={message.tone} className="mt-4">{message.text}</Notice>}
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Current password" htmlFor="current_password" error={errors.current_password?.[0]}>
          <Input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
        </Field>
        <Field label="New password" htmlFor="password" error={errors.password?.[0]}>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} />
        </Field>
        <Field label="Confirm new password" htmlFor="password_confirmation">
          <Input id="password_confirmation" name="password_confirmation" type="password" autoComplete="new-password" required />
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SessionsCard() {
  const sessions = useApiGet<SessionRow[]>("/me/sessions");
  const [error, setError] = useState<string | null>(null);

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-ink-950">Active sessions</h2>
      {error && <Notice tone="danger" className="mb-3">{error}</Notice>}
      <Table head={["Device", "IP address", "Last active", ""]}>
        {(sessions.data ?? []).map((s) => (
          <tr key={s.id}>
            <td className="max-w-xs truncate px-4 py-3 text-ink-700" title={s.user_agent ?? ""}>
              {s.user_agent ?? "Unknown device"} {s.is_current && <Badge tone="brand">This device</Badge>}
            </td>
            <td className="px-4 py-3 font-mono text-xs text-ink-600">{s.ip_address ?? "—"}</td>
            <td className="whitespace-nowrap px-4 py-3 text-ink-600">{formatDateTime(s.last_active_at)}</td>
            <td className="px-4 py-3 text-right">
              {!s.is_current && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await api.delete(`/me/sessions/${s.id}`);
                      sessions.reload();
                    } catch (err) {
                      setError(err instanceof ApiError ? err.message : "Could not sign out that session.");
                    }
                  }}
                >
                  Sign out
                </Button>
              )}
            </td>
          </tr>
        ))}
        {!sessions.loading && (sessions.data ?? []).length === 0 && <EmptyRow colSpan={4}>No session data available.</EmptyRow>}
      </Table>
    </section>
  );
}

function LoginHistoryCard() {
  const history = useApiGet<LoginRow[]>("/me/login-history");
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-ink-950">Recent sign-in activity</h2>
      <Table head={["Result", "IP address", "Device", "Time"]}>
        {(history.data ?? []).map((row, i) => (
          <tr key={`${row.created_at}-${i}`}>
            <td className="px-4 py-3">
              <StatusBadge status={row.outcome} />
            </td>
            <td className="px-4 py-3 font-mono text-xs text-ink-600">{row.ip ?? "—"}</td>
            <td className="max-w-xs truncate px-4 py-3 text-ink-600" title={row.user_agent ?? ""}>
              {row.user_agent ?? "—"}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-ink-600">{formatDateTime(row.created_at)}</td>
          </tr>
        ))}
        {!history.loading && (history.data ?? []).length === 0 && <EmptyRow colSpan={4}>No sign-in activity yet.</EmptyRow>}
      </Table>
    </section>
  );
}
