import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/office", "/portal", "/account", "/login", "/api/", "/verify/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
