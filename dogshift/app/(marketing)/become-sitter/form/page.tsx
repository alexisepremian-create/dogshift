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

    // If we arrived here via an activation code (ds_activation_profile_id cookie) but the
    // profile doesn't belong to the currently signed-in user, the cookies are stale (e.g.
    // from a previous test session). Send the user back to /account so they can use the
    // site as an owner without being stuck in the sitter registration flow.
    if (dbUser && activationProfileId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activationProfile = await (prisma as any).sitterProfile.findUnique({
        where: { id: activationProfileId },
        select: { userId: true },
      });
      if (activationProfile && activationProfile.userId !== dbUser.id) {
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
