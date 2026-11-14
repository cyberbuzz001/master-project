import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const BACKEND_URL = process.env.BACKEND_URL || (isDev ? "http://127.0.0.1:8000" : undefined);

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.expertstocks.in https://*.expertstocks.in",
  "style-src 'self' 'unsafe-inline' https://api.expertstocks.in https://*.expertstocks.in https://fonts.bunny.net",
  "img-src 'self' data: blob: https://api.expertstocks.in https://*.expertstocks.in",
  "font-src 'self' data: https://api.expertstocks.in https://*.expertstocks.in https://fonts.bunny.net",
  "connect-src 'self' https://api.expertstocks.in https://*.expertstocks.in https://fonts.bunny.net https://graph.facebook.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://api.expertstocks.in https://*.expertstocks.in",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  /**
   * Development: proxy API + Sanctum to Laravel so the browser sees one origin and
   * session cookies stay first-party. In production Nginx performs the same routing.
   */
  async rewrites() {
    if (!BACKEND_URL) {
      return [];
    }
    return {
      beforeFiles: [
        // Laravel owns the staff panel. Resolve it before the retired Next.js page.
        { source: "/office", destination: `${BACKEND_URL}/office` },
        { source: "/office/:path*", destination: `${BACKEND_URL}/office/:path*` },
        // Filament and Livewire asset endpoints proxied directly to backend.
        { source: "/filament/:path*", destination: `${BACKEND_URL}/filament/:path*` },
        { source: "/css/filament/:path*", destination: `${BACKEND_URL}/css/filament/:path*` },
        { source: "/js/filament/:path*", destination: `${BACKEND_URL}/js/filament/:path*` },
        { source: "/fonts/filament/:path*", destination: `${BACKEND_URL}/fonts/filament/:path*` },
        { source: "/favicon.svg", destination: `${BACKEND_URL}/favicon.svg` },
        { source: "/:livewire(livewire-[a-f0-9]+)/:path*", destination: `${BACKEND_URL}/:livewire/:path*` },
      ],
      afterFiles: [],
      fallback: [
        { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
        { source: "/sanctum/:path*", destination: `${BACKEND_URL}/sanctum/:path*` },
        { source: "/sso", destination: `${BACKEND_URL}/sso` },
      ],
    };
  },

  /** URLs from the previous site (see docs/CURRENT_SITE_AUDIT.md). */
  async redirects() {
    const retiredTemplatePages = [
      "classic-cap-hpeszv", "face-serum-gxrcld", "handmade-vase-slowpy", "hand-soap-giguos",
      "set-of-plates-cxlzwx", "sunglasses-iubjnq", "wooden-chair-mopukh", "wool-sweater-lortoo",
      "expert-stocks-consultancy-service-providing-equity-and-option-services-worldwide",
      "expert-stocks-consultancy-service-providing-quality-equity-and-option-services-worldwide",
    ];

    return [
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/testimonials-and-portfolio", destination: "/testimonials", permanent: true },
      { source: "/policy", destination: "/legal/refund-policy", permanent: true },
      ...retiredTemplatePages.map((slug) => ({ source: `/${slug}`, destination: "/", permanent: true })),
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
