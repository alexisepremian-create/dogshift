"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignOutPage() {
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirect = (searchParams?.get("redirect") ?? "").trim() || "/login?force=1";

    (async () => {
      try {
        window.localStorage.removeItem("ds_auth_user");
      } catch {
        // ignore
      }

      try {
        try {
          await (clerk as any).signOut({ sessionId: "all" });
        } catch {
          await clerk.signOut();
        }
      } finally {
        router.replace(redirect);
        setTimeout(() => {
          window.location.assign(redirect);
        }, 100);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
