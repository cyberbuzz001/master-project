import Link from "next/link";
import { getSiteData } from "@/lib/api-server";
import { FOOTER_NAV, LEGAL_PAGES, MARKET_RISK_NOTE } from "@/lib/site";
import { Container } from "../ui";
import { CookieSettingsLink } from "./CookieConsent";
import { Logo } from "./Logo";

export async function SiteFooter() {
  const site = await getSiteData();
  const settings = site.ok ? site.data.settings : {};
  const contact = settings.contact ?? {};
  const legalName = settings.company?.legal_entity_name;

  return (
    <footer className="mt-auto border-t border-ink-200 bg-white">
      <Container className="grid gap-10 py-14 lg:grid-cols-[1.3fr_2fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink-600">
            Research-driven, risk-aware market intelligence for Indian markets — with a published methodology and human review before
            publication.
          </p>
          <dl className="mt-5 space-y-1.5 text-sm text-ink-700">
            {contact.email && (
              <div className="flex gap-2">
                <dt className="sr-only">Email</dt>
                <dd>
                  <a className="hover:text-brand-700" href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                </dd>
              </div>
            )}
            {contact.phone && (
              <div className="flex gap-2">
                <dt className="sr-only">Phone</dt>
                <dd>
                  <a className="hover:text-brand-700" href={`tel:${contact.phone.replace(/\s+/g, "")}`}>
                    {contact.phone}
                  </a>
                </dd>
              </div>
            )}
            {contact.business_hours && (
              <div className="flex gap-2">
                <dt className="sr-only">Hours</dt>
                <dd className="text-ink-500">{contact.business_hours}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {Object.entries(FOOTER_NAV).map(([heading, links]) => (
            <div key={heading}>
              <p className="text-sm font-semibold text-ink-900">{heading}</p>
              <ul className="mt-3 space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-ink-600 hover:text-ink-950">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>

      <div className="border-t border-ink-100 bg-ink-50">
        <Container className="space-y-4 py-6">
          <p className="text-xs leading-5 text-ink-600">{MARKET_RISK_NOTE}</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {LEGAL_PAGES.map((page) => (
              <Link key={page.slug} href={`/legal/${page.slug}`} className="text-ink-600 hover:text-ink-950">
                {page.label}
              </Link>
            ))}
            <CookieSettingsLink />
          </nav>
          <p className="text-xs text-ink-500">
            © {new Date().getFullYear()} {legalName ?? "Expert Stocks Consultancy"}. Regulatory details are published in the{" "}
            <Link href="/trust-center" className="underline underline-offset-2 hover:text-ink-800">
              Trust Center
            </Link>{" "}
            only after verification.
          </p>
        </Container>
      </div>
    </footer>
  );
}
