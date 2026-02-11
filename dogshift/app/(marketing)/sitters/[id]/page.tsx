import { redirect } from "next/navigation";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SittersAliasPage({ params, searchParams }: PageProps) {
  const resolvedParams = (typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string })) as {
    id: string;
  };

  const id = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";

  const sp = await searchParams;
  const q = sp ? new URLSearchParams(sp as Record<string, string>).toString() : "";
  redirect(`/sitter/${encodeURIComponent(id)}${q ? `?${q}` : ""}`);
}
