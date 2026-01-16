import { redirect } from "next/navigation";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function SittersAliasPage({ params, searchParams }: PageProps) {
  const resolvedParams = (typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string })) as {
    id: string;
  };

  const id = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";

  const q = searchParams ? new URLSearchParams(searchParams as Record<string, string>).toString() : "";
  redirect(`/sitter/${encodeURIComponent(id)}${q ? `?${q}` : ""}`);
}
