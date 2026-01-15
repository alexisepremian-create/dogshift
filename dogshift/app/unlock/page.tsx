import { redirect } from "next/navigation";

import UnlockClient from "@/components/UnlockClient";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!process.env.SITE_PASSWORD) {
    redirect("/");
  }

  const sp = searchParams ? await searchParams : undefined;

  const nextParam = Array.isArray(sp?.next) ? sp?.next[0] : sp?.next;
  const next = typeof nextParam === "string" && nextParam.trim() ? nextParam : "/";

  return <UnlockClient next={next} />;
}
