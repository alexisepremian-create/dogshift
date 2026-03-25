"use client";

import { MaintenanceProvider } from "@/components/platform/MaintenanceProvider";

export default function SessionAuthProvider({ children }: { children: React.ReactNode }) {
  return <MaintenanceProvider>{children}</MaintenanceProvider>;
}
