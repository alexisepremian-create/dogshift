"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function AuthGooglePage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return null;

  try { sessionStorage.setItem("ds_login_transit", String(Date.now())); } catch {}

  return <AuthenticateWithRedirectCallback />;
}
