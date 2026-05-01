import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { ensureDbUserFromClerkAuth } from "@/lib/auth/resolveDbUserId";
import { prisma } from "@/lib/prisma";
import { isActivatedStatus, normalizeSitterLifecycleStatus } from "@/lib/sitterContract";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";

async function runOnboardingOwner({ email, userId }: { email: string; userId: string }) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "https://dogshift.ch"
  ).replace(/\/$/, "");

  const { html } = renderEmailLayout({
    title: "Bienvenue sur DogShift",
    subtitle: "Trouvez le dog-sitter idéal pour votre compagnon en toute sérénité.",
    summaryTitle: "Pourquoi choisir DogShift ?",
    summaryRows: [
      { label: "Sitters vérifiés", value: "Chaque sitter est sélectionné et vérifié manuellement par notre équipe" },
      { label: "Réservation simple", value: "Choisissez vos dates, confirmez en 2 clics — aucune complication" },
      { label: "Support réactif", value: "Notre équipe répond sous 24 h — Lausanne & Riviera vaudoise" },
    ],
    ctaLabel: "Trouver mon sitter →",
    ctaUrl: `${baseUrl}/search`,
    footerText: "Vous recevez cet email car vous venez de créer un compte DogShift. DogShift • support@dogshift.ch",
    footerLinks: [
      { label: "dogshift.ch", url: baseUrl },
      { label: "support@dogshift.ch", url: "mailto:support@dogshift.ch" },
    ],
  });

  await sendEmail({
    to: email,
    subject: "Bienvenue sur DogShift",
    text: `Bienvenue sur DogShift — la plateforme de dog-sitting premium en Suisse romande.\n\nTrouvez votre sitter : ${baseUrl}/search\n\n— L'équipe DogShift\nsupport@dogshift.ch`,
    html,
  });

  await prisma.scheduledEmail.create({
    data: { userId, email, type: "owner_followup_j3", sendAfter: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), sent: false },
  });

  await prisma.agentLog.create({
    data: {
      agentName: "onboarding-owner",
      actionType: "welcome_sent",
      summary: `Welcome email envoyé à ${email}`,
      details: { email, userId },
      targetId: userId,
      durationMs: 0,
      status: "success",
    },
  });

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "977094430";
  if (TELEGRAM_BOT_TOKEN) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: `🏠 Nouveau propriétaire inscrit : ${email}` }),
    }).catch(() => {});
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ redirect: "/login" }, { status: 401 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic field (clerkUserId not in generated types).
    let dbUser = await (prisma as any).user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, role: true, email: true, sitterId: true },
    });

    if (!dbUser?.id) {
      const ensured = await ensureDbUserFromClerkAuth();
      if (!ensured?.id) {
        console.warn("[resolve-redirect] unable to ensure DB user", { clerkUserId: userId });
        return NextResponse.json({ redirect: "/login?force=1" });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic field.
      dbUser = await (prisma as any).user.findUnique({
        where: { id: ensured.id },
        select: { id: true, role: true, email: true, sitterId: true },
      });

      // Inline onboarding for brand-new OWNER accounts (no HTTP self-call — unreliable on Vercel)
      if (ensured.created && ensured.role === "OWNER" && dbUser?.email) {
        try {
          await runOnboardingOwner({ email: dbUser.email, userId: ensured.id });
        } catch (err) {
          console.warn("[resolve-redirect] onboarding-owner failed", err);
        }
      }
    }

    const sitterProfile = await prisma.sitterProfile.findUnique({
      where: { userId: dbUser.id },
      select: { id: true, lifecycleStatus: true, published: true },
    });

    const lifecycleStatus = sitterProfile
      ? normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, sitterProfile.published)
      : null;

    const isSitter =
      (lifecycleStatus && isActivatedStatus(lifecycleStatus)) ||
      (dbUser.role === "SITTER" && !!dbUser.sitterId);

    // Owners always go to /account — even if there's a stale contract_signed sitter profile
    // from a previous attempt. The activation email contains a direct link to /become-sitter/access.
    const redirect = isSitter ? "/host" : "/account";

    return NextResponse.json({ redirect });
  } catch (e) {
    console.error("[resolve-redirect] failed", {
      clerkUserId: userId,
      error: e instanceof Error ? { name: e.name, message: e.message } : e,
    });
    return NextResponse.json({ redirect: "/login?force=1" });
  }
}
