"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
  return <SignUp routing="path" path="/signup" signInUrl="/login" />;
}
