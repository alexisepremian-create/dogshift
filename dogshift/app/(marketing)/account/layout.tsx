import OwnerDashboardShell from "@/components/OwnerDashboardShell";
import { getUserContexts } from "@/lib/userContexts";
import { isActivatedStatus } from "@/lib/sitterContract";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  let contexts: Awaited<ReturnType<typeof getUserContexts>>;
  try {
    contexts = await getUserContexts();
  } catch {
    redirect("/login");
  }

  const activated =
    contexts.sitterLifecycleStatus != null &&
    isActivatedStatus(contexts.sitterLifecycleStatus);

  console.info("[role-resolution][account/layout]", {
    dbUserId: contexts.dbUserId,
    email: contexts.primaryEmail,
    hasSitterProfile: contexts.hasSitterProfile,
    sitterLifecycleStatus: contexts.sitterLifecycleStatus,
    activated,
    decision: activated ? "REDIRECT_TO_HOST" : "STAY_ACCOUNT",
  });

  if (activated) {
    redirect("/host");
  }

  return <OwnerDashboardShell>{children}</OwnerDashboardShell>;
}
