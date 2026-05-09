"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import AuthLayout from "@/components/auth/AuthLayout";
import SignUpForm from "@/components/auth/SignUpForm";
import { useCanonicalDogshiftHostRedirect } from "@/lib/url/useCanonicalDogshiftHost";

export default function SignUpPage() {
  useCanonicalDogshiftHostRedirect();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();

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
      <SignUpForm />
    </AuthLayout>
  );
}