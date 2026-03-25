import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ sitterId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SittersAliasPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;

  const sitterId = typeof resolvedParams?.sitterId === "string" ? resolvedParams.sitterId : "";

  const sp = await searchParams;
  const q = sp ? new URLSearchParams(sp as Record<string, string>).toString() : "";
  redirect(`/sitter/${encodeURIComponent(sitterId)}${q ? `?${q}` : ""}`);
}
