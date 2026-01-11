import { redirect } from "next/navigation";

import UnlockClient from "@/components/UnlockClient";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (!process.env.SITE_PASSWORD) {
    redirect("/");
  }

  const nextParam = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  const next = typeof nextParam === "string" && nextParam.trim() ? nextParam : "/";

  return <UnlockClient next={next} />;
}
