"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginCatchAllPage() {
  return (
    <div className="flex min-h-[calc(100vh-96px)] w-full items-center justify-center px-4 py-10">
      <SignIn routing="path" path="/login" signUpUrl="/signup" />
    </div>
  );
}
