import { cookies } from "next/headers";

import {
  IMPERSONATION_COOKIE,
  getImpersonationSecret,
  verifyImpersonationToken,
} from "@/lib/auth/impersonation";

import ImpersonationBannerExitForm from "./ImpersonationBannerExitForm";

/**
 * Persistent top banner shown ONLY when an admin is impersonating another
 * user. Renders server-side so there's no client-side flash — if the cookie
 * is valid, the banner is in the SSR HTML from the first byte.
 *
 * Mounted at the very top of `<body>` in `app/layout.tsx`. It uses
 * `position: fixed` with `z-[200]` so it sits above every other UI layer
 * (nav, modals, the Capacitor native bottom-nav, …). We push the rest of
 * the page down with a body class set via the (also server-rendered)
 * `data-impersonating="1"` attribute.
 *
 * If anyone touches this file, KEEP IT VISUALLY LOUD. The whole point is
 * that an admin can never forget they are in impersonation mode — a quiet
 * pill would defeat the entire safety story.
 */
export default async function ImpersonationBanner() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;

  let payload;
  try {
    payload = await verifyImpersonationToken(raw, getImpersonationSecret());
  } catch {
    // If AUTH_SECRET is not available we deliberately render nothing — the
    // cookie was minted with the same secret, so this branch indicates a
    // dev-mode misconfiguration. Loud failure happens server-side via
    // getAuthedDbUser already.
    return null;
  }
  if (!payload) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[200] flex items-center justify-between gap-3 bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.625rem)" }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true">👁️</span>
        <span className="truncate">
          Mode <b>impersonation</b> — tu navigues comme{" "}
          <b className="truncate">{payload.targetEmail}</b>{" "}
          <span className="hidden text-rose-100 sm:inline">
            ({payload.targetRole.toLowerCase()})
          </span>
        </span>
      </div>
      <ImpersonationBannerExitForm />
    </div>
  );
}
