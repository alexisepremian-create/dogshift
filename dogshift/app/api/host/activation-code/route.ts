import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashActivationCode, normalizeSitterLifecycleStatus } from "@/lib/sitterContract";
import { sendSitterOnboardingNudge } from "@/lib/sitterOnboardingNudge";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

export const runtime = "nodejs";

// No Clerk auth required — the activation code itself is the proof of identity
// (it was delivered to the sitter's registered email after contract signature).
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { code?: string } | null;
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!code) {
      return NextResponse.json({ ok: false, error: "CODE_REQUIRED" }, { status: 400 });
    }

    const candidateHash = hashActivationCode(code);

    // Look up the sitter profile directly by code hash — no user session needed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic select.
    const sitterProfile = await (prisma as any).sitterProfile.findFirst({
      where: { activationCodeHash: candidateHash },
      select: {
        id: true,
        userId: true,
        published: true,
        lifecycleStatus: true,
        activationCodeHash: true,
        activationCodeExpiresAt: true,
        activationCodeUsedAt: true,
        user: {
          select: { id: true, name: true, email: true, clerkUserId: true },
        },
      },
    });

    if (!sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "INVALID_ACTIVATION_CODE" }, { status: 403 });
    }

    const lifecycleStatus = normalizeSitterLifecycleStatus(
      sitterProfile.lifecycleStatus,
      Boolean(sitterProfile.published),
    );

    // A sitter already `activated` may re-enter the form (e.g. profile not yet filled).
    // In that case skip code-validity guards — the profile is already good to go.
    const alreadyActivated = lifecycleStatus === "activated";

    if (!alreadyActivated) {
      // Guard: code already used
      if (sitterProfile.activationCodeUsedAt) {
        return NextResponse.json({ ok: false, error: "ACTIVATION_CODE_ALREADY_USED" }, { status: 409 });
      }

      // Guard: code expired
      if (sitterProfile.activationCodeExpiresAt && new Date(sitterProfile.activationCodeExpiresAt) < new Date()) {
        return NextResponse.json({ ok: false, error: "ACTIVATION_CODE_EXPIRED" }, { status: 409 });
      }

      if (lifecycleStatus !== "contract_signed") {
        return NextResponse.json({ ok: false, error: "ACCOUNT_NOT_READY_FOR_ACTIVATION" }, { status: 409 });
      }
    }

    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic update.
    await (prisma as any).sitterProfile.update({
      where: { id: sitterProfile.id },
      data: {
        lifecycleStatus: "activated",
        activatedAt: now,
        activationCodeUsedAt: now,
      },
      select: { id: true },
    });

    // Best-effort Telegram admin notification.
    const name = typeof sitterProfile.user?.name === "string" ? sitterProfile.user.name.trim() : "";
    const email = typeof sitterProfile.user?.email === "string" ? sitterProfile.user.email.trim() : "";
    const namePart = name ? `\n👤 ${name}` : "";
    const emailPart = email ? `\n📧 ${email}` : "";
    await sendTelegramMessage(
      `🚀 Sitter activé !${namePart}${emailPart}\n🆔 ${sitterProfile.userId}`,
      { bot: "candidatures" }
    );

    // Best-effort onboarding welcome email — sends the "welcome" stage of the
    // progressive nudge sequence right after activation. Subsequent stages
    // (J+1, J+3, J+7, J+14) are fired by /api/cron/sitter-onboarding-nudge.
    // Wrapped in try/catch so a failing send never breaks activation itself.
    if (email) {
      try {
        // Re-fetch the profile snapshot needed by the completion calculation
        // (the .findFirst() above only selected a subset of fields).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma client cast while generated types lag the pilot schema.
        const sp = await (prisma as any).sitterProfile.findUnique({
          where: { id: sitterProfile.id },
          select: {
            avatarUrl: true,
            displayName: true,
            city: true,
            address: true,
            bio: true,
            services: true,
            pricing: true,
            acceptsSmall: true,
            acceptsMedium: true,
            acceptsLarge: true,
            stripeAccountStatus: true,
          },
        });
        const firstName = name.split(" ")[0] || "Dogsitter";
        await sendSitterOnboardingNudge({
          stage: "welcome",
          sitterUserId: sitterProfile.userId,
          email,
          firstName,
          profile: {
            avatarUrl: sp?.avatarUrl ?? null,
            firstName: sp?.displayName ?? name,
            city: sp?.city ?? null,
            address: sp?.address ?? null,
            bio: sp?.bio ?? null,
            services: sp?.services ?? null,
            pricing: sp?.pricing ?? null,
            acceptsSmall: sp?.acceptsSmall ?? false,
            acceptsMedium: sp?.acceptsMedium ?? false,
            acceptsLarge: sp?.acceptsLarge ?? false,
            stripeAccountStatus: sp?.stripeAccountStatus ?? null,
          },
        });
      } catch (welcomeErr) {
        console.warn(
          "[api][host][activation-code] welcome email failed (non-blocking)",
          welcomeErr,
        );
      }
    }

    const hasClerkAccount = Boolean(sitterProfile.user?.clerkUserId);
    const sevenDays = 7 * 24 * 60 * 60;
    const secure = process.env.NODE_ENV === "production";

    const res = NextResponse.json(
      { ok: true, lifecycleStatus: "activated", activatedAt: now.toISOString(), hasClerkAccount },
      { status: 200 },
    );

    // Set the same cookies as /api/invites/verify so the existing /become-sitter/form
    // and /api/become-sitter/apply flows work without changes.
    res.cookies.set({ name: "ds_invite_unlocked", value: "1", httpOnly: true, secure, sameSite: "lax", maxAge: sevenDays, path: "/" });
    res.cookies.set({ name: "ds_invite", value: "1", httpOnly: true, secure, sameSite: "lax", maxAge: sevenDays, path: "/" });
    // Store the sitter profile id so the apply endpoint can use it as an alternative to inviteId.
    res.cookies.set({ name: "ds_activation_profile_id", value: sitterProfile.id, httpOnly: true, secure, sameSite: "lax", maxAge: sevenDays, path: "/" });

    return res;
  } catch (err) {
    console.error("[api][host][activation-code][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
