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

const securityHeaders = [
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
