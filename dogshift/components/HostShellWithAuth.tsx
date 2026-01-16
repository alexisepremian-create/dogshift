"use client";

import HostDashboardShell from "@/components/HostDashboardShell";

export default function HostShellWithAuth({ children }: { children: React.ReactNode }) {
  return <HostDashboardShell>{children}</HostDashboardShell>;
}
