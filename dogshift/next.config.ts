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

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
