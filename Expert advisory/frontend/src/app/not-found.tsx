import { LogoMark } from "@/components/site/Logo";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <LogoMark className="mx-auto size-10" />
        <p className="mt-6 font-mono text-sm text-teal-600">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Page not found</h1>
        <p className="mt-2 text-ink-600">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-8 flex justify-center gap-3">
          <LinkButton href="/">Go home</LinkButton>
          <LinkButton href="/contact" variant="secondary">Contact us</LinkButton>
        </div>
      </div>
    </main>
  );
}
