"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginCatchAllPage() {
  return <SignIn routing="path" path="/login" signUpUrl="/signup" />;
}
