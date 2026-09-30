import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/site/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Secure sign-in for clients and staff.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">Sign in</h1>
          <p className="mt-1.5 text-sm text-ink-600">For clients and Expert Stocks staff.</p>
          <div className="mt-8">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
          <p className="mt-10 text-xs leading-5 text-ink-500">
            Never share your password or authentication codes — our team will never ask for them. Need help?{" "}
            <Link href="/contact" className="font-medium text-brand-700 underline underline-offset-2">
              Contact us
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <div className="bg-grid absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(47_107_239/0.5),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgb(19_165_143/0.35),transparent_55%)]" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-end p-14">
          <p className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white text-balance">Every report traceable. Every approval recorded.</p>
          <p className="mt-4 max-w-md text-sm leading-6 text-ink-300">
            Staff accounts are protected by two-factor authentication, and every sign-in is logged.
          </p>
        </div>
      </div>
    </div>
  );
}
