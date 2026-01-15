"use client";

import ClerkAuthGate from "@/components/ClerkAuthGate";
import HostDashboardShell from "@/components/HostDashboardShell";
import HostDataGate from "@/components/HostDataGate";

export default function HostShellWithAuth({ children }: { children: React.ReactNode }) {
  return (
    <ClerkAuthGate redirectTo="/login">
      <HostDataGate>
        <HostDashboardShell>{children}</HostDashboardShell>
      </HostDataGate>
    </ClerkAuthGate>
  );
}
