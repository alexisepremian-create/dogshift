"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function AuthGooglePage() {
  return <AuthenticateWithRedirectCallback />;
}
