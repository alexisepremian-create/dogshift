import HostDashboardShell from "@/components/HostDashboardShell";
import { HostUserProvider } from "@/components/HostUserProvider";
import { getHostUserData } from "@/lib/hostUser";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

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
  if (!hostUser.sitterId) {
    redirect("/onboarding");
  }
  return (
    <HostUserProvider value={hostUser}>
      <HostDashboardShell>{children}</HostDashboardShell>
    </HostUserProvider>
  );
}
