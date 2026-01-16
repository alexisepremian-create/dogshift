import HostDashboardShell from "@/components/HostDashboardShell";
import HostHydrationGate from "@/components/HostHydrationGate";
import { HostUserProvider } from "@/components/HostUserProvider";
import PageLoader from "@/components/ui/PageLoader";
import { getHostUserData } from "@/lib/hostUser";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DS_DEBUG_ROUTING === "1") {
    console.log("[HOST_LAYOUT_RENDER]");
  }

  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const hostUser = await getHostUserData();

  const hostDataReady =
    Boolean(hostUser.sitterId) &&
    typeof hostUser.profileCompletion === "number" &&
    hostUser.termsAcceptedAt !== null;

  if (!hostDataReady) {
    return <PageLoader label="Chargement…" />;
  }
  return (
    <HostUserProvider value={hostUser}>
      <Suspense fallback={<PageLoader label="Chargement…" />}>
        <HostHydrationGate>
          <HostDashboardShell>{children}</HostDashboardShell>
        </HostHydrationGate>
      </Suspense>
    </HostUserProvider>
  );
}
