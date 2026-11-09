import type { NextConfig } from "next";

/**
 * The browser only ever talks to the web origin. `/api/vetnex/*` is proxied to the
 * NestJS API so the session cookie stays first-party (HttpOnly, SameSite=Lax) and
 * no CORS credentials handling is required in the browser.
 */
const apiOrigin = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@vetnex/ui", "@vetnex/shared", "@vetnex/permissions"],
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async rewrites() {
    return [
      {
        source: "/api/vetnex/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
