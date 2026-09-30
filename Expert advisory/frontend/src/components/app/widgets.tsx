"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, Lock, X, XCircle } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { ApiError, ModuleStatus, ReadinessCheck } from "@/lib/api-types";
import { Badge, Button, Card, cx, Field, Textarea } from "../ui";

export function StatCard({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: string; tone?: "neutral" | "warning" | "danger" | "positive" }) {
  const valueTone = { neutral: "text-ink-950", warning: "text-warning-700", danger: "text-danger-600", positive: "text-positive-600" }[tone];
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className={cx("mt-2 font-mono text-3xl font-medium tabular-nums", valueTone)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </Card>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-ink-500" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ApiErrorView({ error, code, message }: { error?: ApiError | null; code?: string; message?: string }) {
  const errorCode = error?.code ?? code;
  const text = error?.message ?? message ?? "Something went wrong.";
  const isAccess = errorCode === "FORBIDDEN" || errorCode?.startsWith("TWO_FACTOR");
  return (
    <Card className="flex items-start gap-3 p-5">
      {isAccess ? <Lock className="mt-0.5 size-5 text-ink-500" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-5 text-danger-600" aria-hidden="true" />}
      <div>
        <p className="text-sm font-semibold text-ink-900">{isAccess ? "Access restricted" : "Couldn't load this section"}</p>
        <p className="mt-0.5 text-sm text-ink-600">{text}</p>
        {error?.requestId && <p className="mt-2 font-mono text-[11px] text-ink-400">Request ID {error.requestId}</p>}
      </div>
    </Card>
  );
}

export function ModulesPanel({ modules }: { modules: ModuleStatus[] }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-ink-900">Modules</p>
      <p className="mt-0.5 text-xs text-ink-500">Metrics appear here as each module goes live. No placeholder figures are shown.</p>
      <ul className="mt-4 divide-y divide-ink-100">
        {modules.map((m) => (
          <li key={m.key} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-ink-700">{m.label}</span>
            {m.enabled ? <Badge tone="positive">Live</Badge> : <Badge>Phase {m.phase}</Badge>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ReadinessList({ checks }: { checks: ReadinessCheck[] }) {
  return (
    <ul className="divide-y divide-ink-100">
      {checks.map((check) => (
        <li key={check.key} className="flex gap-3 py-3">
          {check.passed ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive-600" aria-label="Passed" />
          ) : (
            <XCircle className="mt-0.5 size-5 shrink-0 text-danger-600" aria-label="Not passed" />
          )}
          <div>
            <p className="text-sm font-medium text-ink-900">{check.label}</p>
            <p className="text-sm text-ink-600">{check.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    ({
      verified: "positive",
      published: "positive",
      active: "positive",
      success: "positive",
      approved: "teal",
      pending_verification: "warning",
      draft: "neutral",
      superseded: "neutral",
      rejected: "danger",
      deactivated: "danger",
      suspended: "warning",
      failed: "danger",
      locked: "danger",
      "2fa_failed": "danger",
      "2fa_required": "brand",
    } as const)[status] ?? "neutral";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="absolute inset-0 bg-ink-950/40" aria-label="Close dialog" onClick={onClose} />
      <div ref={ref} className={cx("relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-[var(--shadow-lift)] sm:rounded-2xl animate-rise", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-ink-950">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-500 hover:bg-ink-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Collects a mandatory reason for audited actions. */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
    if (reason.length < 3) {
      setError("Please give a reason. It is stored in the audit log.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {description && <p className="text-sm leading-6 text-ink-600">{description}</p>}
        <Field label="Reason (recorded in the audit log)" htmlFor={id} error={error ?? undefined}>
          <Textarea id={id} name="reason" rows={3} maxLength={500} required />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-ink-500">
        <CircleDashed className="mx-auto mb-2 size-5 text-ink-400" aria-hidden="true" />
        {children}
      </td>
    </tr>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-ink-100 text-left text-sm">
          <thead className="bg-ink-50">
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

export function Pagination({ meta, page, onPage }: { meta?: Record<string, unknown>; page: number; onPage: (page: number) => void }) {
  const last = Number(meta?.last_page ?? 1);
  const total = Number(meta?.total ?? 0);
  if (last <= 1) return total > 0 ? <p className="mt-3 text-xs text-ink-500">{total} records</p> : null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <p className="text-ink-500">
        Page {page} of {last} · {total} records
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= last} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
