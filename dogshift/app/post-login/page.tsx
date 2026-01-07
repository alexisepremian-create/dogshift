"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

export default function PostLoginPage() {
  const { data, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") return;

    const next = (searchParams?.get("next") ?? "").trim();
    if (next) {
      router.replace(next);
      return;
    }

    const role = (data?.user as any)?.role as string | undefined;
    router.replace(role === "SITTER" ? "/host" : "/account");
  }, [status, data, router, searchParams]);

  return null;
}
