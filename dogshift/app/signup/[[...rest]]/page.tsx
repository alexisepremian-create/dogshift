"use client";

import { SignUp } from "@clerk/nextjs";
import AuthCenteredWrapper from "@/components/AuthCenteredWrapper";
import { clerkAppearance } from "@/lib/clerkAppearance";

export default function SignupCatchAllPage() {
  return (
    <AuthCenteredWrapper>
      <SignUp
        routing="path"
        path="/signup"
        signInUrl="/login"
        appearance={clerkAppearance}
      />
    </AuthCenteredWrapper>
  );
}
