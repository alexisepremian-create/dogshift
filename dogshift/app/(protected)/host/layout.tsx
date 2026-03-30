import HostDashboardShell from "@/components/HostDashboardShell";
import HostDataGate from "@/components/HostDataGate";
import HostHydrationGate from "@/components/HostHydrationGate";
import { HostUserProvider } from "@/components/HostUserProvider";
import { getHostUserData } from "@/lib/hostUser";
import { isActivatedStatus } from "@/lib/sitterContract";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DS_DEBUG_ROUTING === "1") {
    console.log("[HOST_LAYOUT_RENDER]");
  }

  const { userId } = await auth();
  console.info("[host-layout][diagnostic] auth state", {
    userId: userId ?? null,
  });
  if (!userId) {
    redirect("/login");
  }

  let hostUser: Awaited<ReturnType<typeof getHostUserData>>;
  try {
    hostUser = await getHostUserData();
    console.info("[host-layout][diagnostic] getHostUserData resolved", {
      userId,
      sitterId: hostUser.sitterId,
      lifecycleStatus: hostUser.lifecycleStatus,
      profileCompletion: hostUser.profileCompletion,
      contractSignedAt: hostUser.contractSignedAt,
      activatedAt: hostUser.activatedAt,
    });
  } catch (error: any) {
    if (error && typeof error === "object" && "digest" in error) {
      if (typeof error.digest === "string" && error.digest.startsWith("NEXT_")) {
        throw error;
      }
    }
    console.error("[host-layout][diagnostic] dashboard unavailable fallback", error);
    return (
      <div className="fixed inset-0 z-50 flex w-full items-center justify-center bg-white font-sans">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <p className="text-base font-semibold text-slate-900">Accès dashboard indisponible</p>
          <p className="mt-2 text-sm text-slate-600">
            Impossible de charger votre espace dogsitter pour le moment. Réessayez dans quelques instants ou revenez à l’accueil.
          </p>
          <div className="mt-5 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Retour accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!hostUser.sitterId) {
    console.warn("[host-layout][diagnostic] redirecting because sitterId is missing", {
      userId,
      hostUser,
      reason: "MISSING_SITTER_ID",
    });
    redirect("/account");
  }

  if (!isActivatedStatus(hostUser.lifecycleStatus)) {
    console.warn("[host-layout][diagnostic] redirecting because sitter is not activated", {
      userId,
      sitterId: hostUser.sitterId,
      lifecycleStatus: hostUser.lifecycleStatus,
      reason: "HOST_NOT_ACTIVATED",
    });
    redirect("/account");
  }

  return (
    <HostUserProvider value={hostUser}>
      <Suspense fallback={null}>
        <HostDataGate>
          <HostHydrationGate>
            <HostDashboardShell>{children}</HostDashboardShell>
          </HostHydrationGate>
        </HostDataGate>
      </Suspense>
    </HostUserProvider>
  );
}
