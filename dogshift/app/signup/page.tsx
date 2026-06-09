"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import AuthLayout from "@/components/auth/AuthLayout";
import AuthFlow from "@/components/auth/AuthFlow";
import { useCanonicalDogshiftHostRedirect } from "@/lib/url/useCanonicalDogshiftHost";

export default function SignUpPage() {
  useCanonicalDogshiftHostRedirect();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: __sessionStatus } = useSession();
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";

  const force = (searchParams?.get("force") ?? "").trim();
  const forceMode = force === "1" || force.toLowerCase() === "true";
  const next = (searchParams?.get("next") ?? "").trim();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;
    if (forceMode) return;
    router.replace(next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login");
  }, [forceMode, isLoaded, isSignedIn, next, router]);

  return (
    <AuthLayout>
      <AuthFlow />
    </AuthLayout>
  );
}