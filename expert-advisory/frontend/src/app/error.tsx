"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client error safely
    console.error("[App Error Boundary caught]:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[#05070B] text-[#F5F7FA]">
      <div className="max-w-md w-full rounded-2xl border border-[#1C2734] bg-[#0D131C] p-6 sm:p-8 text-center shadow-2xl">
        <div className="mx-auto size-12 rounded-full bg-[#F05252]/10 border border-[#F05252]/20 flex items-center justify-center text-[#F05252] mb-4">
          <AlertCircle className="size-6" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold font-display text-[#F5F7FA]">
          Unable to display page
        </h1>

        <p className="mt-2 text-sm text-[#9AA7B5] leading-relaxed">
          Your browser experienced a momentary display interruption. This often occurs on systems with strict privacy shields or older graphics drivers.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#43D9FF] px-5 py-2.5 text-sm font-semibold text-[#05070B] hover:bg-[#43D9FF]/90 transition-colors shadow-[0_0_20px_rgba(67,217,255,0.3)] cursor-pointer"
          >
            <RotateCcw className="size-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1C2734] bg-[#111923] px-5 py-2.5 text-sm font-semibold text-[#F5F7FA] hover:bg-[#16212E] transition-colors"
          >
            <Home className="size-4" />
            <span>Go Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
