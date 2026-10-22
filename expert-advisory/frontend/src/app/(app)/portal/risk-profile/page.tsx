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

      {error && <p className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-300">{error}</p>}

      <form className="space-y-5" onSubmit={submit}>
        {questions.map((question, index) => {
          const selected = answers[question.code];
          const invalid = fieldErrors[question.code]?.[0];

          return (
            <Card key={question.code} className="p-6 bg-[#090E1A] border-[#1E293B]">
              <fieldset>
                <legend className="text-base font-semibold text-[#F5F7FA]">
                  {index + 1}. {question.text}
                </legend>
                {question.help_text && <p className="mt-1 text-sm text-slate-400">{question.help_text}</p>}
                {question.type === "multi_choice" && <p className="mt-1.5 text-xs text-cyan-400 font-mono">Choose all that apply.</p>}
                <div className="mt-4 space-y-2.5">
                  {question.options.map((option) => {
                    const isMulti = question.type === "multi_choice";
                    const checked = isMulti ? Array.isArray(selected) && selected.includes(option.value) : selected === option.value;

                    return (
                      <label
                        key={option.value}
                        className="group flex cursor-pointer items-center gap-3.5 rounded-xl px-4 py-3 bg-[#0B101B] border border-[#1E293B] hover:border-slate-600 transition-all has-checked:bg-cyan-500/10 has-checked:border-cyan-400 has-checked:shadow-[0_0_15px_rgba(67,217,255,0.12)]"
                      >
                        <input
                          type={isMulti ? "checkbox" : "radio"}
                          name={question.code}
                          value={option.value}
                          checked={checked}
                          onChange={() => (isMulti ? toggleMulti(question.code, option.value) : setSingle(question.code, option.value))}
                          className="size-4 accent-cyan-400 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
                {invalid && <p className="mt-2 text-xs font-medium text-rose-400">{invalid}</p>}
              </fieldset>
            </Card>
          );
        })}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Submit answers"}
          </Button>
          <p className="text-xs text-slate-400 font-mono">Method {methodology}. You can retake this whenever your circumstances change.</p>
        </div>
      </form>
    </>
  );
}
