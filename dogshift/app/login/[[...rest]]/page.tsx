"use client";

import { SignIn } from "@clerk/nextjs";
import AuthCenteredWrapper from "@/components/AuthCenteredWrapper";
import { clerkAppearance } from "@/lib/clerkAppearance";

export default function LoginCatchAllPage() {
  return (
    <AuthCenteredWrapper>
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/signup"
        appearance={clerkAppearance}
      />
    </AuthCenteredWrapper>
  );
}
