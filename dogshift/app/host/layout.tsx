import HostDashboardShell from "@/components/HostDashboardShell";
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
        <HostDashboardShell>{children}</HostDashboardShell>
      </Suspense>
    </HostUserProvider>
  );
}
