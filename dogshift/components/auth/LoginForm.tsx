"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

import { dogshiftClerkAppearance } from "./clerkAppearance";

/**
 * Sign-in form using Clerk's prebuilt <SignIn /> component.
 *
 * See `SignUpForm.tsx` for the rationale on using prebuilt components.
 */
export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = (searchParams?.get("next") ?? "").trim();
  const redirectAfterAuth = next
    ? `/post-login?next=${encodeURIComponent(next)}`
    : "/post-login";

  return (
    <SignIn
      appearance={dogshiftClerkAppearance}
      signUpUrl="/signup"
      forceRedirectUrl={redirectAfterAuth}
    />
  );
}
