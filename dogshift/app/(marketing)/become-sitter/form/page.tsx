import BecomeSitterForm from "@/components/BecomeSitterForm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
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

  const { userId } = await auth();
  if (userId) {
    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    const dbUser = primaryEmail
      ? await ensureDbUserByClerkUserId({
          clerkUserId: userId,
          email: primaryEmail,
          name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
        })
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
