"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import PageLoader from "@/components/ui/PageLoader";

export default function ClerkAuthGate({
  children,
  redirectTo = "/login",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) return;
    router.replace(redirectTo);
  }, [isLoaded, isSignedIn, redirectTo, router]);

  if (!isLoaded) {
    return <PageLoader label="Chargement…" />;
  }

  if (!isSignedIn) {
    return <PageLoader label="Connexion en cours…" />;
  }

  return <>{children}</>;
}
