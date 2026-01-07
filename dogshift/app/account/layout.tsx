import OwnerDashboardShell from "@/components/OwnerDashboardShell";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <OwnerDashboardShell>{children}</OwnerDashboardShell>;
}
