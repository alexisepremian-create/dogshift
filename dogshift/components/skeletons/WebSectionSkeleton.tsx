"use client";

import { usePathname } from "next/navigation";

import HostDashboardSkeleton from "@/components/HostDashboardSkeleton";
import AccountPageSkeleton from "@/components/ui/AccountPageSkeleton";
import DashboardSkeleton from "@/components/ui/DashboardSkeleton";

/**
 * IN-FLOW (never `fixed`) skeleton for WEB dashboard section loads.
 *
 * The sitter (/host) and owner (/account) dashboards keep a persistent left
 * sidebar in the shell layout. The old web fallback was the full-screen
 * running-dog <PageLoader /> which covered that sidebar on every section
 * switch. Rendering an in-flow skeleton instead makes it appear INSIDE the
 * shell's <main> column, so the sidebar stays visible — like a native app.
 *
 * Pathname-aware so the shape roughly matches the destination (mirrors the
 * native branch of NativeRouteFallback, but without the `fixed inset-0`).
 */
export default function WebSectionSkeleton() {
  const pathname = usePathname() ?? "";

  if (pathname === "/host") {
    return <HostDashboardSkeleton />;
  }
  if (pathname.startsWith("/account")) {
    return <AccountPageSkeleton />;
  }
  // /host/requests, /host/messages and every other dashboard section → the
  // generic list skeleton (title + chips + rows), which is already in-flow.
  return <DashboardSkeleton />;
}
