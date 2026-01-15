"use client";

import ClerkAuthGate from "@/components/ClerkAuthGate";
import HostDashboardShell from "@/components/HostDashboardShell";

export default function HostShellWithAuth({ children }: { children: React.ReactNode }) {
  return (
    <ClerkAuthGate redirectTo="/login">
      <HostDashboardShell>{children}</HostDashboardShell>
    </ClerkAuthGate>
  );
}
