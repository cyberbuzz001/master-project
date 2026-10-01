export const SITE = {
  name: "Expert Stocks Consultancy",
  shortName: "Expert Stocks",
  tagline: "MARKET INTELLIGENCE, ENGINEERED.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://expertstocks.in",
  description:
    "Research-driven market intelligence for Indian markets, supported by structured methodology, risk-aware analysis, transparent disclosures and appropriate human review.",
};

export const PRIMARY_NAV = [
  { href: "/#markets", label: "Markets" },
  { href: "/research", label: "Research" },
  { href: "/services", label: "Services" },
  { href: "/#tools", label: "Tools" },
  { href: "/#academy", label: "Academy" },
  { href: "/trust-center", label: "Trust Center" },
] as const;

export const FOOTER_NAV = {
  Company: [
    { href: "/about", label: "About" },
    { href: "/technology", label: "Technology" },
    { href: "/services", label: "Services" },
    { href: "/pricing", label: "Plans" },
    { href: "/contact", label: "Contact" },
  ],
  Markets: [
    { href: "/#markets", label: "Market Snapshot" },
    { href: "/#sector-pulse", label: "Sector Pulse" },
    { href: "/#terminal", label: "Research Terminal" },
    { href: "/#tools", label: "Financial Tools" },
  ],
  Research: [
    { href: "/research", label: "Research Archive" },
    { href: "/market-insights", label: "Market Insights" },
    { href: "/methodology", label: "Methodology" },
    { href: "/blog", label: "Blog" },
    { href: "/#academy", label: "Academy" },
  ],
  Trust: [
    { href: "/trust-center", label: "Trust Center" },
    { href: "/legal/risk-disclosure", label: "Risk Disclosure" },
    { href: "/legal/investor-charter", label: "Investor Charter" },
    { href: "/legal/grievance-redressal", label: "Grievance" },
    { href: "/legal/privacy-policy", label: "Privacy" },
    { href: "/legal/terms-of-use", label: "Terms" },
    { href: "/legal/refund-policy", label: "Refund Policy" },
    { href: "/legal/cookie-policy", label: "Cookies" },
  ],
} as const;

/** Legal pages that always appear in the footer; each renders the published version or a "being reviewed" notice. */
export const LEGAL_PAGES = [
  { slug: "privacy-policy", label: "Privacy" },
  { slug: "terms-of-use", label: "Terms" },
  { slug: "disclaimer", label: "Disclaimer" },
  { slug: "refund-policy", label: "Refund policy" },
  { slug: "risk-disclosure", label: "Risk disclosure" },
  { slug: "investor-charter", label: "Investor charter" },
  { slug: "grievance-redressal", label: "Grievance redressal" },
  { slug: "cookie-policy", label: "Cookies" },
] as const;

export const MARKET_RISK_NOTE =
  "Investments in securities market are subject to market risks. Read all related documents carefully before investing.";

