import BecomeSitterForm from "@/components/BecomeSitterForm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export default async function BecomeSitterFormPage() {
  const c = await cookies();
  const unlocked = c.get("ds_invite_unlocked")?.value === "1";
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

    const isAlreadySitter = dbUser
      ? Boolean(await prisma.sitterProfile.findUnique({ where: { userId: dbUser.id }, select: { id: true } }))
      : false;

    if (isAlreadySitter) {
      redirect("/host");
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
