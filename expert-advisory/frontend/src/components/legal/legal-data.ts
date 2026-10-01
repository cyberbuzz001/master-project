import {
  AlertTriangle,
  FileText,
  Headset,
  Lock,
  FileCheck,
  RefreshCw,
  Cookie,
  Shield,
  Scale,
} from "lucide-react";

export interface LegalDocInfo {
  slug: string;
  title: string;
  category: "Disclosures" | "Investor Protection" | "Policies";
  categoryBadge: string;
  lead: string;
  version: number;
  effectiveDate: string;
  lastUpdated: string;
  iconName: string;
  keywords: string[];
}

export const LEGAL_DOCS: LegalDocInfo[] = [
  {
    slug: "risk-disclosure",
    title: "Risk Disclosure",
    category: "Disclosures",
    categoryBadge: "Statutory Disclosure",
    lead: "Understand the market volatility, derivative trading risks, and execution limitations before participating in Indian financial markets.",
    version: 1,
    effectiveDate: "01 January 2026",
    lastUpdated: "01 January 2026",
    iconName: "alert-triangle",
    keywords: ["risk", "market", "volatility", "fno", "derivatives", "options", "futures", "capital loss", "stop loss", "slippage", "sebi"],
  },
  {
    slug: "investor-charter",
    title: "Investor Charter",
    category: "Investor Protection",
    categoryBadge: "Regulatory Charter",
    lead: "Investor rights, responsibilities, research analyst code of conduct, and mandatory advisory safeguards under SEBI frameworks.",
    version: 1,
    effectiveDate: "01 January 2026",
    lastUpdated: "01 January 2026",
    iconName: "scale",
    keywords: ["charter", "investor rights", "services", "dos and donts", "sebi", "research analyst", "complaint", "responsibilities"],
  },
  {
    slug: "grievance-redressal",
    title: "Grievance Redressal",
    category: "Investor Protection",
    categoryBadge: "Compliance Framework",
    lead: "Structured 2-tier escalation matrix for prompt, fair, and dedicated resolution of investor concerns and billing queries.",
    version: 1,
    effectiveDate: "01 January 2026",
    lastUpdated: "01 January 2026",
    iconName: "headset",
    keywords: ["grievance", "complaint", "support", "escalation", "officer", "helpdesk", "dispute", "redressal"],
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    category: "Policies",
    categoryBadge: "Data Governance",
    lead: "How your personal details, KYC records, and device data are collected, protected by encryption, and processed in compliance with Indian laws.",
    version: 1,
    effectiveDate: "01 January 2026",
    lastUpdated: "01 January 2026",
    iconName: "lock",
    keywords: ["privacy", "data", "kyc", "pan", "personal information", "encryption", "safeguards", "retention", "consent"],
  },
  {
    slug: "terms-of-use",
    title: "Terms of Use",
    category: "Policies",
    categoryBadge: "Service Agreement",
    lead: "Terms governing access to research publications, portal analytical tools, intellectual property rights, and platform usage.",
    version: 1,
    effectiveDate: "01 January 2026",
    lastUpdated: "01 January 2026",
    iconName: "file-check",
    keywords: ["terms", "conditions", "acceptance", "intellectual property", "liability", "governing law", "service agreement"],
  },
  {
    slug: "refund-policy",
    title: "Refund Policy",
    category: "Policies",
    categoryBadge: "Billing & Subscriptions",
    lead: "Transparent pre-activation cancellation and post-activation policies for research advisory subscriptions and plan tiers.",
    version: 1,
    effectiveDate: "01 January 2026",
    lastUpdated: "01 January 2026",
    iconName: "refresh-cw",
    keywords: ["refund", "cancellation", "payment", "activation", "chargeback", "billing", "subscription", "fees"],
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    category: "Policies",
    categoryBadge: "Platform Telemetry",
    lead: "Explanation of session cookies, CSRF tokens, and privacy-preserving performance telemetry used across our digital interfaces.",
    version: 1,
    effectiveDate: "01 January 2026",
    lastUpdated: "01 January 2026",
    iconName: "cookie",
    keywords: ["cookies", "session", "csrf", "analytics", "preferences", "storage", "telemetry"],
  },
];

export const LEGAL_CATEGORIES = [
  { name: "Disclosures", count: 1 },
  { name: "Investor Protection", count: 2 },
  { name: "Policies", count: 4 },
] as const;

export function getLegalDocBySlug(slug: string): LegalDocInfo | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}

export function getRelatedDocs(currentSlug: string): LegalDocInfo[] {
  return LEGAL_DOCS.filter((d) => d.slug !== currentSlug).slice(0, 3);
}
