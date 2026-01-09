"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return <SignIn routing="path" path="/login" signUpUrl="/signup" />;
}
