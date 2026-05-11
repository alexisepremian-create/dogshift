import BecomeSitterForm from "@/components/BecomeSitterForm";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export default async function BecomeSitterFormPage() {
  const c = await cookies();
  const activationProfileId = c.get("ds_activation_profile_id")?.value ?? null;
  const unlocked =
    c.get("ds_invite_unlocked")?.value === "1" ||
    !!activationProfileId;
  if (!unlocked) {
    redirect("/devenir-dogsitter");
  }

  const __authed = await getAuthedDbUser();
    const userId = __authed?.id ?? null;
  if (userId) {
    // (() => null) /* currentUser removed */() removed — use __authed.email / __authed.name
    const primaryEmail = __authed?.email ?? "";
    const dbUser = primaryEmail
      ? (__authed ? { id: __authed.id, role: __authed.role, sitterId: __authed.sitterId, created: false } : null)
      : null;

    if (dbUser?.role === "SITTER") {
      redirect("/host");
    }

    // If the ds_activation_profile_id cookie points to a sitter profile that is ALREADY
    // claimed by a different Clerk-authenticated user, the cookie is stale (e.g. left over
    // from a previous test session). In that case send the user back to /account.
    // If the profile is unlinked (userId null) or linked to a DB user without a Clerk
    // account, the current logged-in user can still claim it by completing the form, so
    // we let them through.
    if (dbUser && activationProfileId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activationProfile = await (prisma as any).sitterProfile.findUnique({
        where: { id: activationProfileId },
        select: {
          userId: true,
          user: { select: { clerkUserId: true } },
        },
      });
      const claimedByOtherUser =
        !!activationProfile &&
        !!activationProfile.userId &&
        activationProfile.userId !== dbUser.id &&
        !!activationProfile.user?.clerkUserId;
      if (claimedByOtherUser) {
        redirect("/account");
      }
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <BecomeSitterForm />
        </div>
      </main>
    </div>
  );
}
