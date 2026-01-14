"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export default function LoginCatchAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const qs = searchParams?.toString() ?? "";
    router.replace(qs ? `/login?${qs}` : "/login");
  }, [router, searchParams]);

  return null;
}
