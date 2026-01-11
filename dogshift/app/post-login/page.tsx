"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function PostLoginPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;

    const next = (searchParams?.get("next") ?? "").trim();
    if (next) {
      router.replace(next);
      return;
    }

    router.replace("/account");
  }, [isLoaded, isSignedIn, router, searchParams]);

  return null;
}
