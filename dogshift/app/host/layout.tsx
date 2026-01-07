import HostDashboardShell from "@/components/HostDashboardShell";

export default function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HostDashboardShell>{children}</HostDashboardShell>
  );
}
