import HostDashboardShell from "@/components/HostDashboardShell";
import { HostUserProvider } from "@/components/HostUserProvider";
import { getHostUserData } from "@/lib/hostUser";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hostUser = await getHostUserData();
  return (
    <HostUserProvider value={hostUser}>
      <HostDashboardShell>{children}</HostDashboardShell>
    </HostUserProvider>
  );
}
