"use client";

import { useState } from "react";

/**
 * "Quitter" button inside the impersonation banner. POSTs to
 * /api/admin/impersonate/stop, then forces a full reload to `/admin/users` so
 * every cached server-component result for the impersonated user is purged
 * from the React cache.
 *
 * Kept as a tiny client component so the parent banner can stay a server
 * component (and thus read the signed cookie without exposing it to the
 * client bundle).
 */
export default function ImpersonationBannerExitForm() {
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/admin/impersonate/stop", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
    } catch {
      // Even on network failure, force a reload — the cookie will be missing
      // server-side if /stop succeeded; if it failed, we'll just re-render
      // the banner and the admin can retry.
    } finally {
      window.location.href = "/admin/users";
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={submitting}
      style={{ touchAction: "manipulation" }}
      className="inline-flex shrink-0 items-center rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white outline-none ring-white/40 transition hover:bg-white/25 focus-visible:ring-2 disabled:cursor-wait disabled:opacity-70"
    >
      {submitting ? "Sortie…" : "Quitter"}
    </button>
  );
}
