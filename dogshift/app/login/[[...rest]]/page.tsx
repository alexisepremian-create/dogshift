"use client";

import { SignIn } from "@clerk/nextjs";
import AuthCenteredWrapper from "@/components/AuthCenteredWrapper";

export default function LoginCatchAllPage() {
  return (
    <AuthCenteredWrapper>
      <SignIn routing="path" path="/login" signUpUrl="/signup" />
    </AuthCenteredWrapper>
  );
}
