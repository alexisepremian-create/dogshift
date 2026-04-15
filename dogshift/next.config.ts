import type { NextConfig } from "next";

const envNextAuthUrl = process.env.NEXTAUTH_URL;
const envNextAuthSecretPresent = Boolean((process.env.NEXTAUTH_SECRET || "").trim());
const envGoogleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
const envDatabaseUrl = process.env.DATABASE_URL;

console.log("[boot][env]", {
  NEXTAUTH_URL: envNextAuthUrl ?? null,
  NEXTAUTH_SECRET: envNextAuthSecretPresent ? "present" : "missing",
  GOOGLE_CLIENT_ID: envGoogleClientId ? `${envGoogleClientId.slice(0, 6)}…` : "missing",
  DATABASE_URL: envDatabaseUrl ?? null,
});

const csp = [
  // Only load resources from self by default
  "default-src 'self'",
  // Scripts: self + inline (Next.js hydration + login transit) + Google Ads + Clerk
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://js.stripe.com https://*.clerk.com https://*.clerk.accounts.dev",
  // Styles: self + inline (Tailwind, Clerk injected styles)
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URIs + blob (canvas/jspdf) + Google avatars + MapTiler tiles + any https
  "img-src 'self' data: blob: https:",
  // Fonts: self + data URIs
  "font-src 'self' data:",
  // API/WebSocket calls: self + Clerk + Stripe + MapTiler + Google Ads
  [
    "connect-src 'self'",
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
    "wss://*.clerk.com",
    "https://api.stripe.com",
    "https://api.maptiler.com",
    "https://*.maptiler.com",
    "https://www.googletagmanager.com",
    "https://www.google.com",
    "https://googleads.g.doubleclick.net",
  ].join(" "),
  // Iframes: Stripe payment iframes
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
  // Workers: self + blob (used by MapLibre/MapTiler GL)
  "worker-src 'self' blob:",
  // Objects: none
  "object-src 'none'",
  // Base URI: restrict to self to prevent base tag injection
  "base-uri 'self'",
  // Form submissions: self only
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: csp,
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
