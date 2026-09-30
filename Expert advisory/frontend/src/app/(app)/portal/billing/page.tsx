"use client";

import { FileText, Receipt as ReceiptIcon } from "lucide-react";
import { useState } from "react";
import { PageTitle } from "@/components/app/AppShell";
import { formatDate, humanize, useApiGet } from "@/components/app/hooks";
import { ApiErrorView, Spinner } from "@/components/app/widgets";
import { Badge, Button, Card } from "@/components/ui";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/api-types";

type Subscription = {
  uuid: string;
  service: string | null;
  plan: string | null;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  days_remaining: number | null;
};

type InvoiceRow = {
  uuid: string;
  number: string;
  status: string;
  invoice_date: string;
  due_date: string;
  total: string;
  balance: string;
  has_pdf: boolean;
};

type PaymentRow = {
  uuid: string;
  amount: string;
  method: string;
  status: string;
  received_at: string | null;
  invoice_number: string | null;
  has_receipt: boolean;
};

type Billing = {
  subscriptions: Subscription[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  notice: string;
};

const TONES: Record<string, "positive" | "warning" | "danger" | "neutral" | "brand"> = {
  active: "positive",
  paid: "positive",
  succeeded: "positive",
  pending_activation: "warning",
  pending_verification: "warning",
  partially_paid: "warning",
  issued: "brand",
  overdue: "danger",
  failed: "danger",
  paused: "danger",
  void: "neutral",
  expired: "neutral",
  cancelled: "neutral",
  refunded: "neutral",
};

export default function BillingPage() {
  const billing = useApiGet<Billing>("/client/billing");
  const [error, setError] = useState<string | null>(null);

  if (billing.loading && !billing.data) return <Spinner />;
  if (billing.error) return <ApiErrorView error={billing.error} />;
  if (!billing.data) return null;

  const { subscriptions, invoices, payments, notice } = billing.data;

  const open = async (path: string) => {
    setError(null);
    try {
      const res = await api.get<{ url: string }>(path);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The document could not be opened.");
    }
  };

  return (
    <>
      <PageTitle title="Services & billing" description="Your services, invoices and the payments we have received." />

      {error && <p className="mb-4 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</p>}

      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-sm font-semibold text-ink-900">Your services</p>
          <ul className="mt-4 divide-y divide-ink-100">
            {subscriptions.length === 0 && <li className="py-3 text-sm text-ink-500">No service has been set up yet.</li>}
            {subscriptions.map((subscription) => (
              <li key={subscription.uuid} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {subscription.service} {subscription.plan && <span className="text-ink-500">· {subscription.plan}</span>}
                  </p>
                  <p className="text-xs text-ink-500">
                    {subscription.starts_on ? `From ${formatDate(subscription.starts_on)}` : "Starts once payment is confirmed"}
                    {subscription.ends_on ? ` · until ${formatDate(subscription.ends_on)}` : ""}
                    {subscription.days_remaining !== null ? ` · ${subscription.days_remaining} days left` : ""}
                  </p>
                </div>
                <Badge tone={TONES[subscription.status] ?? "neutral"}>{humanize(subscription.status)}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-semibold text-ink-900">Invoices</p>
          <ul className="mt-4 divide-y divide-ink-100">
            {invoices.length === 0 && <li className="py-3 text-sm text-ink-500">No invoice has been raised yet.</li>}
            {invoices.map((invoice) => (
              <li key={invoice.uuid} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-4 text-ink-400" aria-hidden="true" />
                  <div>
                    <p className="font-mono text-sm text-ink-900">{invoice.number}</p>
                    <p className="text-xs text-ink-500">
                      Raised {formatDate(invoice.invoice_date)} · due {formatDate(invoice.due_date)} · balance {invoice.balance}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink-900">{invoice.total}</span>
                  <Badge tone={TONES[invoice.status] ?? "neutral"}>{humanize(invoice.status)}</Badge>
                  <Button variant="ghost" onClick={() => open(`/client/invoices/${invoice.uuid}/pdf`)}>
                    Open
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-semibold text-ink-900">Payments received</p>
          <ul className="mt-4 divide-y divide-ink-100">
            {payments.length === 0 && <li className="py-3 text-sm text-ink-500">Nothing received yet.</li>}
            {payments.map((payment) => (
              <li key={payment.uuid} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-start gap-3">
                  <ReceiptIcon className="mt-0.5 size-4 text-ink-400" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-ink-900">
                      {payment.amount} <span className="text-ink-500">· {payment.method}</span>
                    </p>
                    <p className="text-xs text-ink-500">
                      {payment.received_at ? formatDate(payment.received_at) : "—"}
                      {payment.invoice_number ? ` · against ${payment.invoice_number}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={TONES[payment.status] ?? "neutral"}>{humanize(payment.status)}</Badge>
                  {payment.has_receipt && (
                    <Button variant="ghost" onClick={() => open(`/client/payments/${payment.uuid}/receipt`)}>
                      Receipt
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-5 text-ink-500">
            A payment shows as received once our team has confirmed it against the bank account. {notice}
          </p>
        </Card>
      </div>
    </>
  );
}
