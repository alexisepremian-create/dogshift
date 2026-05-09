"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

import { dogshiftClerkAppearance } from "./clerkAppearance";

/**
 * Sign-up form using Clerk's prebuilt <SignUp /> component.
 *
 * Why prebuilt instead of custom?
 *  - Clerk maintains the auth flow internals (CAPTCHA, OTP, OAuth, error
 *    handling, session activation) so we never have to fix Clerk-side
 *    breaking changes again.
 *  - Visual customization is fully driven by `dogshiftClerkAppearance`,
 *    matching the previous DogShift design.
 */
export default function SignUpForm() {
  const searchParams = useSearchParams();
  const next = (searchParams?.get("next") ?? "").trim();
  const redirectAfterAuth = next
    ? `/post-login?next=${encodeURIComponent(next)}`
    : "/post-login";

  return (
    <SignUp
      appearance={dogshiftClerkAppearance}
      signInUrl="/login"
      forceRedirectUrl={redirectAfterAuth}
    />
  );
}
