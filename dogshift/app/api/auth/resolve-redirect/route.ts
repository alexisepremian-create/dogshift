import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { ensureDbUserFromClerkAuth } from "@/lib/auth/resolveDbUserId";
import { prisma } from "@/lib/prisma";
import { isActivatedStatus, normalizeSitterLifecycleStatus } from "@/lib/sitterContract";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

async function runOnboardingOwner({ email, userId, name }: { email: string; userId: string; name?: string }) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "https://dogshift.ch"
  ).replace(/\/$/, "");

  const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
  const D = `<td valign="top" style="padding:8px 10px 0 0;width:10px;"><div style="width:10px;height:10px;border-radius:50%;background:#818cf8;"></div></td>`;
  const DG = `<td valign="top" style="padding:8px 10px 0 0;width:10px;"><div style="width:10px;height:10px;border-radius:50%;background:#4ade80;"></div></td>`;
  const logoUrl = `${baseUrl}/dogshift-logo.png`;

  const welcomeTipsHtml = `
    <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
      <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Bien démarrer sur DogShift</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tr>${D}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Parcours les sitters</strong> — filtre par service, disponibilité et zone géographique.</td></tr>
        <tr>${D}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Lis les profils</strong> — photos, avis et descriptions te donnent une idée claire de chaque sitter.</td></tr>
        <tr>${D}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Réserve en quelques clics</strong> — choisis tes dates, confirme et laisse DogShift gérer le reste.</td></tr>
      </table>
    </div>
    <div style="margin-top:14px;padding:14px 18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tr>${DG}<td style="font-family:${FF};font-size:13px;line-height:20px;color:#166534;"><strong>Chaque sitter est vérifié manuellement</strong> — identité, domicile et entretien individuel avant publication.</td></tr>
      </table>
    </div>`;

  const firstName = name ? name.trim().split(/\s+/)[0] : "";
  const greeting = firstName ? `Bienvenue ${firstName} !` : "Bienvenue sur DogShift";

  const { html } = renderEmailLayout({
    logoUrl,
    title: greeting,
    subtitle: "Trouvez le dog-sitter idéal pour votre compagnon en toute sérénité.",
    summaryTitle: "Pourquoi choisir DogShift ?",
    summaryRows: [
      { label: "Sitters vérifiés", value: "Chaque sitter est sélectionné et vérifié manuellement par notre équipe" },
      { label: "Réservation simple", value: "Choisissez vos dates, confirmez en 2 clics — aucune complication" },
      { label: "Support réactif", value: "Notre équipe répond sous 24 h — Lausanne & Riviera vaudoise" },
    ],
    extraHtml: welcomeTipsHtml,
    ctaLabel: "Trouver mon sitter →",
    ctaUrl: `${baseUrl}/search`,
    secondaryLinkLabel: "Comment ça marche",
    secondaryLinkUrl: `${baseUrl}/how-it-works`,
    footerText: "Vous recevez cet email car vous venez de créer un compte DogShift. DogShift • support@dogshift.ch",
    footerLinks: [
      { label: "dogshift.ch", url: baseUrl },
      { label: "support@dogshift.ch", url: "mailto:support@dogshift.ch" },
    ],
  });

  await sendEmail({
    to: email,
    subject: firstName ? `Bienvenue ${firstName} — DogShift` : "Bienvenue sur DogShift",
    text: `${greeting} — la plateforme de dog-sitting premium en Suisse romande.\n\nSitters vérifiés manuellement par notre équipe\nRéservation simple en 2 clics\nSupport réactif — Lausanne & Riviera vaudoise\n\nTrouvez votre sitter : ${baseUrl}/search\n\n— L'équipe DogShift\nsupport@dogshift.ch`,
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

  await sendTelegramMessage(`🏠 Nouveau propriétaire inscrit : ${email}`, { bot: "relances" }).catch(() => {});
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
      select: { id: true, role: true, email: true, sitterId: true, name: true },
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
        select: { id: true, role: true, email: true, sitterId: true, name: true },
      });

      // Inline onboarding for brand-new OWNER accounts (no HTTP self-call — unreliable on Vercel)
      if (ensured.created && ensured.role === "OWNER" && dbUser?.email) {
        try {
          await runOnboardingOwner({ email: dbUser.email, userId: ensured.id, name: dbUser.name ?? undefined });
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
