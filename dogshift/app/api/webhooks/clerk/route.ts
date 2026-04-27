import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Clerk webhook handler.
 * Handles `user.deleted`: unlinks clerkUserId from DB user and resets the
 * sitter lifecycle so the sitter can re-activate via their activation code.
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET ?? "";
  if (!secret) {
    console.error("[webhooks][clerk] CLERK_WEBHOOK_SECRET not set");
    return NextResponse.json({ ok: false, error: "MISCONFIGURED" }, { status: 500 });
  }

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  const body = await req.text();

  let event: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch (err) {
    console.error("[webhooks][clerk] signature verification failed", err);
    return NextResponse.json({ ok: false, error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  if (event.type === "user.deleted") {
    const clerkUserId = typeof event.data.id === "string" ? event.data.id : null;
    if (!clerkUserId) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    try {
      // Find the DB user linked to this Clerk account.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbUser = await (prisma as any).user.findUnique({
        where: { clerkUserId },
        select: { id: true, sitterId: true },
      });

      if (!dbUser) {
        console.info("[webhooks][clerk][user.deleted] no DB user found for", { clerkUserId });
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      // Unlink the Clerk account from the DB user.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).user.update({
        where: { id: dbUser.id },
        data: { clerkUserId: null },
      });

      // Reset the sitter profile so the user can re-activate after creating
      // a new Clerk account with the same email.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profile = await (prisma as any).sitterProfile.findUnique({
        where: { userId: dbUser.id },
        select: { id: true, lifecycleStatus: true, published: true },
      });

      if (profile?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).sitterProfile.update({
          where: { id: profile.id },
          data: {
            // Downgrade to contract_signed so the activation code flow works again.
            lifecycleStatus: "contract_signed",
            activatedAt: null,
            activationCodeUsedAt: null,
            published: false,
          },
        });
        console.info("[webhooks][clerk][user.deleted] sitter profile reset to contract_signed", {
          clerkUserId,
          dbUserId: dbUser.id,
          profileId: profile.id,
        });
      }
    } catch (err) {
      console.error("[webhooks][clerk][user.deleted] DB error", err);
      return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
