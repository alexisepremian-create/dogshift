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

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;
    if (forceMode) return;
    router.replace("/post-login");
  }, [forceMode, isLoaded, isSignedIn, router]);

  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}