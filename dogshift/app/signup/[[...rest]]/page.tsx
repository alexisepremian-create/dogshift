"use client";

import { SignUp } from "@clerk/nextjs";
import AuthCenteredWrapper from "@/components/AuthCenteredWrapper";

export default function SignupCatchAllPage() {
  return (
    <AuthCenteredWrapper>
      <SignUp routing="path" path="/signup" signInUrl="/login" />
    </AuthCenteredWrapper>
  );
}
