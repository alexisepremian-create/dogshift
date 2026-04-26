import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashActivationCode, normalizeSitterLifecycleStatus } from "@/lib/sitterContract";
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
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "INVALID_ACTIVATION_CODE" }, { status: 403 });
    }

    // Guard: code already used
    if (sitterProfile.activationCodeUsedAt) {
      return NextResponse.json({ ok: false, error: "ACTIVATION_CODE_ALREADY_USED" }, { status: 409 });
    }

    // Guard: code expired
    if (sitterProfile.activationCodeExpiresAt && new Date(sitterProfile.activationCodeExpiresAt) < new Date()) {
      return NextResponse.json({ ok: false, error: "ACTIVATION_CODE_EXPIRED" }, { status: 409 });
    }

    const lifecycleStatus = normalizeSitterLifecycleStatus(
      sitterProfile.lifecycleStatus,
      Boolean(sitterProfile.published),
    );
    if (lifecycleStatus !== "contract_signed") {
      return NextResponse.json({ ok: false, error: "ACCOUNT_NOT_READY_FOR_ACTIVATION" }, { status: 409 });
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
    );

    return NextResponse.json(
      { ok: true, lifecycleStatus: "activated", activatedAt: now.toISOString() },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api][host][activation-code][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
