"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PageTitle } from "@/components/app/AppShell";
import { useApiGet } from "@/components/app/hooks";
import { ApiErrorView, Spinner } from "@/components/app/widgets";
import { Button, Card } from "@/components/ui";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/api-types";

type Question = {
  code: string;
  text: string;
  help_text: string | null;
  type: "single_choice" | "multi_choice";
  options: { value: string; label: string }[];
};

type Questionnaire = { title: string; methodology_version: string; questions: Question[] };

export default function RiskProfilePage() {
  const questionnaire = useApiGet<Questionnaire>("/client/risk-questionnaire");
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  if (questionnaire.loading && !questionnaire.data) return <Spinner />;
  if (questionnaire.error) return <ApiErrorView error={questionnaire.error} />;
  if (!questionnaire.data) return null;

  const { title, methodology_version: methodology, questions } = questionnaire.data;

  const setSingle = (code: string, value: string) => setAnswers((current) => ({ ...current, [code]: value }));

  const toggleMulti = (code: string, value: string) =>
    setAnswers((current) => {
      const selected = Array.isArray(current[code]) ? (current[code] as string[]) : [];
      return { ...current, [code]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] };
    });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.post("/client/risk-profile", { answers });
      router.push("/portal/onboarding");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageTitle
        title={title}
        description="Your answers are scored by a fixed rule set — the same answers always produce the same result. Nothing here is investment advice."
      />

      {error && <p className="mb-4 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</p>}

      <form className="space-y-5" onSubmit={submit}>
        {questions.map((question, index) => {
          const selected = answers[question.code];
          const invalid = fieldErrors[question.code]?.[0];

          return (
            <Card key={question.code} className="p-6">
              <fieldset>
                <legend className="text-sm font-semibold text-ink-900">
                  {index + 1}. {question.text}
                </legend>
                {question.help_text && <p className="mt-1 text-sm text-ink-600">{question.help_text}</p>}
                {question.type === "multi_choice" && <p className="mt-1 text-xs text-ink-500">Choose all that apply.</p>}
                <div className="mt-3 space-y-2">
                  {question.options.map((option) => {
                    const isMulti = question.type === "multi_choice";
                    const checked = isMulti ? Array.isArray(selected) && selected.includes(option.value) : selected === option.value;

                    return (
                      <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-ink-200 has-checked:bg-brand-50 has-checked:ring-brand-500">
                        <input
                          type={isMulti ? "checkbox" : "radio"}
                          name={question.code}
                          value={option.value}
                          checked={checked}
                          onChange={() => (isMulti ? toggleMulti(question.code, option.value) : setSingle(question.code, option.value))}
                          className="size-4 accent-brand-600"
                        />
                        <span className="text-sm text-ink-800">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
                {invalid && <p className="mt-2 text-xs font-medium text-danger-600">{invalid}</p>}
              </fieldset>
            </Card>
          );
        })}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Submit answers"}
          </Button>
          <p className="text-xs text-ink-500">Method {methodology}. You can retake this whenever your circumstances change.</p>
        </div>
      </form>
    </>
  );
}
