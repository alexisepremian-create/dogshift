"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { clerkAppearance } from "@/lib/clerkAppearance";

export default function SignupCatchAllPage() {
  const searchParams = useSearchParams();
  const next = (searchParams?.get("next") ?? "").trim();
  const after = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  return (
    <AuthShell title="Créer un compte" subtitle="Rejoignez DogShift en quelques clics">
      <SignUp
        routing="path"
        path="/signup"
        signInUrl="/login"
        afterSignUpUrl={after}
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
