"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import AuthCenteredWrapper from "@/components/AuthCenteredWrapper";
import { clerkAppearance } from "@/lib/clerkAppearance";

export default function LoginCatchAllPage() {
  const searchParams = useSearchParams();
  const next = (searchParams?.get("next") ?? "").trim();
  const after = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  return (
    <AuthCenteredWrapper>
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/signup"
        afterSignInUrl={after}
        appearance={clerkAppearance}
      />
    </AuthCenteredWrapper>
  );
}
