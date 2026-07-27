"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, PawPrint } from "lucide-react";

type Tab = "browse" | "applications" | "listings";

/**
 * Adoption home — native-only shell hosting the three sides of the feature:
 * browsing dogs to adopt, tracking one's applications, and managing one's own
 * listings. The feed, filters and composer land in the follow-up PRs.
 */
export default function AdoptionHome() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("browse");

  const tabBtn = (t: Tab) =>
    `flex-1 rounded-full py-2 text-sm font-semibold transition ${tab === t ? "bg-white text-[#7c3aed] shadow-sm" : "text-slate-500"}`;

  return (
    // Floors above the global bottom nav (var --ds-bottom-nav-h) so the app's
    // bottom navigation stays visible + tappable on this screen (founder).
    <div className="fixed inset-x-0 top-0 z-[45] flex flex-col bg-slate-50" style={{ bottom: "var(--ds-bottom-nav-h, 0px)" }}>
      <div className="shrink-0 bg-white px-4 pb-2" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Adoption</h1>
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2 flex gap-1 rounded-full bg-slate-100 p-1">
          <button type="button" className={tabBtn("browse")} onClick={() => setTab("browse")}>Adopter</button>
          <button type="button" className={tabBtn("applications")} onClick={() => setTab("applications")}>Candidatures</button>
          <button type="button" className={tabBtn("listings")} onClick={() => setTab("listings")}>Mes annonces</button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed]/10">
            <PawPrint className="h-8 w-8 text-[#7c3aed]" />
          </div>
          <p className="text-base font-semibold text-slate-900">
            {tab === "browse" ? "Aucun chien à l'adoption pour le moment" : tab === "applications" ? "Aucune candidature" : "Aucune annonce"}
          </p>
          <p className="max-w-xs text-sm text-slate-500">
            {tab === "browse"
              ? "Les premières annonces arrivent très bientôt. Reviens dans quelques jours."
              : tab === "applications"
                ? "Tes candidatures apparaîtront ici dès que tu auras contacté un chien."
                : "Tu pourras bientôt publier une annonce pour trouver une nouvelle famille à ton chien."}
          </p>
        </div>
      </div>
    </div>
  );
}
