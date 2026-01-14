"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export default function AuthGooglePopupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams?.toString() ?? "";
    router.replace(qs ? `/post-login?${qs}` : "/post-login");
  }, [router, searchParams]);

  return null;
}
