"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { clerkAppearance } from "@/lib/clerkAppearance";

export default function LoginCatchAllPage() {
  const searchParams = useSearchParams();
  const next = (searchParams?.get("next") ?? "").trim();
  const after = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  return (
    <AuthShell title="Se connecter" subtitle="Accédez à votre espace DogShift">
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/signup"
        afterSignInUrl={after}
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
