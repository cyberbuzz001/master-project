import type { MetadataRoute } from "next";
import { LEGAL_PAGES, SITE } from "@/lib/site";

const PAGES = [
  "", "/about", "/services", "/research", "/market-insights", "/risk-assessment", "/pricing", "/methodology",
  "/technology", "/resources", "/blog", "/faq", "/testimonials", "/contact", "/trust-center",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PAGES.map((path) => ({ url: `${SITE.url}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 })),
    ...LEGAL_PAGES.map((page) => ({ url: `${SITE.url}/legal/${page.slug}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
