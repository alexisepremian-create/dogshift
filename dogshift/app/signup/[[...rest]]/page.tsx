"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignupCatchAllPage() {
  return <SignUp routing="path" path="/signup" signInUrl="/login" />;
}
