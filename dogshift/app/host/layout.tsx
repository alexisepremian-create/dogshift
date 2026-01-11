import HostDashboardShell from "@/components/HostDashboardShell";

export const dynamic = "force-dynamic";

export default function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HostDashboardShell>{children}</HostDashboardShell>
  );
}
