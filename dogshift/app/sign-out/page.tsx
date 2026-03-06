"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function SignOutPage() {
  const clerk = useClerk();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!(clerk as any)?.loaded) return;
    const redirect = (searchParams?.get("redirect") ?? "").trim() || "/login?force=1";

    const fallback = window.setTimeout(() => {
      window.location.assign(redirect);
    }, 2500);

    (async () => {
      try {
        window.localStorage.removeItem("ds_auth_user");
      } catch {
        // ignore
      }

      try {
        // Let Clerk control redirect completion: avoids navigating away before cookies are cleared.
        await (clerk as any).signOut({ redirectUrl: redirect, sessionId: "all" });
      } catch {
        await clerk.signOut({ redirectUrl: redirect } as any);
      } finally {
        window.clearTimeout(fallback);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerk, searchParams]);

  return null;
}
