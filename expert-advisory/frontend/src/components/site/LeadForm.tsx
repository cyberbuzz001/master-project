"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { ApiError, type SiteData } from "@/lib/api-types";
import { captureAttribution, type Attribution } from "@/lib/attribution";
import { Button, Field, Input, Notice, Select, Textarea } from "../ui";

type FormKey = "contact" | "talk_to_team" | "risk_assessment" | "landing_page" | "resource_download";

const SEGMENTS = [
  { value: "equity", label: "Equity" },
  { value: "futures", label: "Futures" },
  { value: "options", label: "Options" },
  { value: "commodity", label: "Commodities" },
];

export function LeadForm({
  formKey,
  consentText,
  submitLabel = "Send enquiry",
  showMessage = true,
  compact = false,
}: {
  formKey: FormKey;
  consentText: SiteData["consent_text"] | null;
  submitLabel?: string;
  showMessage?: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const attribution = useRef<Attribution>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState("");

  useEffect(() => {
    attribution.current = captureAttribution();
  }, []);

  if (!consentText) {
    return (
      <Notice tone="neutral" title="The enquiry form is temporarily unavailable">
        Please try again in a few minutes.
      </Notice>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("submitting");
    setErrors({});
    setFormError(null);

    const optional = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value === "" ? null : value;
    };

    try {
      const response = await api.post<{ message: string }>("/public/leads", {
        full_name: String(form.get("full_name") ?? ""),
        mobile: String(form.get("mobile") ?? ""),
        email: optional("email"),
        city: optional("city"),
        message: optional("message"),
        capital_range: optional("capital_range"),
        segments: form.getAll("segments"),
        form_key: formKey,
        website: String(form.get("website") ?? ""),
        consents: {
          data_processing: form.get("consent_data_processing") === "on",
          calls: form.get("consent_calls") === "on",
          whatsapp: form.get("consent_whatsapp") === "on",
          marketing_email: form.get("consent_marketing_email") === "on",
        },
        attribution: attribution.current,
      });
      setDoneMessage(response.data.message);
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      if (err instanceof ApiError && err.code === "VALIDATION_FAILED") {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(err.fieldErrors)) mapped[field] = messages[0];
        setErrors(mapped);
        setFormError("Please check the highlighted fields.");
      } else if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setFormError("You've sent several enquiries in a short time. Please wait a minute and try again.");
      } else {
        setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      }
    }
  }

  if (status === "done") {
    return (
      <div
        className="flex flex-col items-start gap-4 rounded-2xl border border-[#22C55E]/40 bg-[#0D131C] p-6 sm:p-8 shadow-2xl animate-rise text-[#F5F7FA]"
        role="status"
      >
        <div className="size-12 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E]">
          <CheckCircle2 className="size-6 text-[#22C55E]" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xl font-bold font-display text-[#F5F7FA]">Enquiry Received</p>
          <p className="mt-2 text-sm leading-relaxed text-[#D1D5DB]">{doneMessage}</p>
        </div>
        <div className="mt-2 w-full pt-4 border-t border-[#1C2734] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-[#22C55E] font-medium">
            <span className="size-2 rounded-full bg-[#22C55E] animate-pulse" />
            Request Logged in Advisory Desk
          </span>
          <a
            href="https://wa.me/919589615649"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[#43D9FF] hover:underline"
          >
            <span>Connect on WhatsApp Desk</span>
            <span>&rarr;</span>
          </a>
        </div>
      </div>
    );
  }

  const f = (name: string) => `${id}-${name}`;
  const invalid = (name: string) => (errors[name] ? { "aria-invalid": true, "aria-describedby": `${f(name)}-error` } : {});

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <Notice tone="danger">{formError}</Notice>}

      {/* Honeypot: hidden from people and assistive tech. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={f("website")}>Website</label>
        <input id={f("website")} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
        <Field label="Full name" htmlFor={f("full_name")} error={errors.full_name}>
          <Input id={f("full_name")} name="full_name" autoComplete="name" required minLength={2} maxLength={120} {...invalid("full_name")} />
        </Field>
        <Field label="Mobile number" htmlFor={f("mobile")} error={errors.mobile}>
          <Input id={f("mobile")} name="mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required {...invalid("mobile")} />
        </Field>
        <Field label="Email" htmlFor={f("email")} error={errors.email} optional>
          <Input id={f("email")} name="email" type="email" autoComplete="email" {...invalid("email")} />
        </Field>
        <Field label="City" htmlFor={f("city")} error={errors.city} optional>
          <Input id={f("city")} name="city" autoComplete="address-level2" {...invalid("city")} />
        </Field>
      </div>

      {!compact && (
        <>
          <fieldset>
            <legend className="text-sm font-medium text-ink-800">Markets you follow</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SEGMENTS.map((segment) => (
                <label
                  key={segment.value}
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm text-ink-700 ring-1 ring-ink-200 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 has-[:checked]:ring-brand-200"
                >
                  <input type="checkbox" name="segments" value={segment.value} className="size-3.5 accent-brand-600" />
                  {segment.label}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Approximate capital you plan to allocate" htmlFor={f("capital_range")} optional hint="Helps us understand suitability. You can skip this.">
            <Select id={f("capital_range")} name="capital_range" defaultValue="">
              <option value="">Prefer to discuss</option>
              <option value="under_1l">Under ₹1 lakh</option>
              <option value="1l_5l">₹1–5 lakh</option>
              <option value="5l_25l">₹5–25 lakh</option>
              <option value="25l_1cr">₹25 lakh – ₹1 crore</option>
              <option value="over_1cr">Above ₹1 crore</option>
            </Select>
          </Field>
        </>
      )}

      {showMessage && (
        <Field label="How can we help?" htmlFor={f("message")} error={errors.message} optional>
          <Textarea id={f("message")} name="message" maxLength={2000} rows={compact ? 3 : 4} {...invalid("message")} />
        </Field>
      )}

      <fieldset className="space-y-2.5 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-100">
        <legend className="sr-only">Consent</legend>
        <ConsentCheckbox name="consent_data_processing" required text={consentText.data_processing} error={errors["consents.data_processing"]}>
          {" "}
          <Link href="/legal/privacy-policy" className="font-medium text-brand-700 underline underline-offset-2">
            Privacy Policy
          </Link>
        </ConsentCheckbox>
        <ConsentCheckbox name="consent_calls" text={consentText.calls} />
        <ConsentCheckbox name="consent_whatsapp" text={consentText.whatsapp} />
        <ConsentCheckbox name="consent_marketing_email" text={consentText.marketing_email} />
      </fieldset>

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={status === "submitting"}>
        {status === "submitting" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {status === "submitting" ? "Sending…" : submitLabel}
      </Button>
    </form>
  );
}

function ConsentCheckbox({
  name,
  text,
  required,
  error,
  children,
}: {
  name: string;
  text: string;
  required?: boolean;
  error?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex gap-2.5 text-xs leading-5 text-ink-700">
        <input type="checkbox" name={name} required={required} className="mt-0.5 size-4 shrink-0 accent-brand-600" aria-invalid={error ? true : undefined} />
        <span>
          {text}
          {children}
          {required && <span className="text-danger-600"> *</span>}
        </span>
      </label>
      {error && <p className="mt-1 pl-6 text-xs font-medium text-danger-600">Please accept this to send your enquiry.</p>}
    </div>
  );
}
