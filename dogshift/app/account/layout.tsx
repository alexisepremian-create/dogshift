import OwnerDashboardShell from "@/components/OwnerDashboardShell";
import { getUserContexts } from "@/lib/userContexts";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  let contexts: Awaited<ReturnType<typeof getUserContexts>>;
  try {
    contexts = await getUserContexts();
  } catch {
    redirect("/login");
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[guard][account/layout] allow account routes", {
      path: "/account/*",
      hasSitterProfile: contexts.hasSitterProfile,
      dbUserId: contexts.dbUserId,
    });
  }

  return <OwnerDashboardShell>{children}</OwnerDashboardShell>;
}
