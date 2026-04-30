import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

/**
 * Content Security Policy (CSP)
 *
 * ⚠️  Si tu ajoutes un nouveau service externe (ex: Crisp chat, Sentry, Hotjar,
 *     nouvelles analytics, CDN...), tu DOIS ajouter ses domaines ici, sinon
 *     le navigateur bloquera ses requêtes silencieusement.
 *
 * Services actuellement autorisés :
 *   - Clerk      → authentification utilisateurs
 *   - Stripe     → paiements (JS + iframes)
 *   - MapTiler   → cartes interactives
 *   - Google Ads → AW-18081650051 (via googletagmanager.com)
 *   - Sentry     → monitoring d'erreurs (ingest.de.sentry.io)
 *
 * Pour déboguer un service bloqué : ouvre la console navigateur,
 * cherche les erreurs "Content Security Policy" ou "CSP".
 */
const csp = [
  // Only load resources from self by default
  "default-src 'self'",
  // Scripts: self + inline (Next.js hydration + login transit) + Google Ads + Clerk
  // clerk.dogshift.ch = sous-domaine personnalisé Clerk (proxy sur ton domaine)
  // 'unsafe-eval' is required in dev for Next.js HMR source maps; omitted in prod
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://js.stripe.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.dogshift.ch https://challenges.cloudflare.com https://googleads.g.doubleclick.net https://www.google.com`,
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
    "https://clerk.dogshift.ch",
    "https://challenges.cloudflare.com",
    "wss://*.clerk.com",
    "wss://clerk.dogshift.ch",
    "https://api.stripe.com",
    "https://api.maptiler.com",
    "https://*.maptiler.com",
    "https://www.googletagmanager.com",
    "https://www.google.com",
    "https://googleads.g.doubleclick.net",
    "https://*.sentry.io",
    "https://ingest.de.sentry.io",
    // Cloudflare R2 presigned URLs (téléchargement contrats PDF)
    "https://*.r2.cloudflarestorage.com",
  ].join(" "),
  // Iframes: Stripe payment iframes
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://challenges.cloudflare.com",
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
    // ⚠️ Si tu affiches des images depuis un nouveau domaine externe (ex: nouveau
    //    bucket R2, CDN, service d'avatars...), ajoute son hostname ici sinon
    //    Next.js refusera d'optimiser/afficher l'image.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google avatars (connexion Google)
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

export default withSentryConfig(nextConfig, {
  org: "dogshift",
  project: "javascript-nextjs",

  // Upload source maps to Sentry for readable stack traces in prod
  // Requires SENTRY_AUTH_TOKEN env var on Vercel (optional but recommended)
  silent: !process.env.CI,

  // Disable source map upload if no auth token is set (avoids build errors)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  // Disable Sentry telemetry
  telemetry: false,

  // Auto-instrument API routes and server components
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
});
