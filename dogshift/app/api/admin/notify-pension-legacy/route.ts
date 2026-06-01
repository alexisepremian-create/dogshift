/**
 * One-shot endpoint: send pension verification notification emails to legacy_pending sitters.
 * GET /api/admin/notify-pension-legacy
 * Admin-only. Delete after use.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const access = await getRequestAdminAccess(req);
  if (!access.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Optional ?emails=a@x.com,b@x.com to restrict sending to specific addresses
  const filterEmails = (req.nextUrl.searchParams.get("emails") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const sitters = await prisma.$queryRaw<
    { sitterId: string; displayName: string | null; email: string | null }[]
  >`
    SELECT sp."sitterId", sp."displayName", u.email
    FROM "SitterProfile" sp
    JOIN "User" u ON u.id = sp."userId"
    WHERE sp."pensionVerifStatus" = 'legacy_pending'
    ORDER BY sp."displayName"
  `;

  const filtered = filterEmails.length > 0
    ? sitters.filter((s) => s.email && filterEmails.includes(s.email.toLowerCase()))
    : sitters;

  const results: { email: string; status: "sent" | "failed" | "skipped"; error?: string }[] = [];

  for (const sitter of filtered) {
    const email = sitter.email;
    const firstName = (sitter.displayName ?? "").split(" ")[0] || "Bonjour";

    if (!email) {
      results.push({ email: "(none)", status: "skipped" });
      continue;
    }

    // Small delay to avoid Resend rate limiting
    await new Promise((r) => setTimeout(r, 400));

    const { html } = renderEmailLayout({
      title: "Nouvelle vérification requise pour activer la Pension",
      subtitle: `Bonjour ${firstName},`,
      extraHtml: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:16px;">
          <p style="margin:0 0 12px 0;">
            Nous avons mis en place un nouveau système de vérification pour le service <strong>Pension</strong> (garde à domicile).
            Pour garantir la sécurité et le bien-être des chiens confiés, chaque dogsitter proposant ce service doit désormais faire vérifier son logement.
          </p>
          <p style="margin:0 0 12px 0;"><strong>Ce que vous devez faire (dans les 30 jours) :</strong></p>
          <ol style="margin:0 0 16px 0;padding-left:20px;">
            <li style="margin-bottom:8px;">Connectez-vous à votre espace sitter</li>
            <li style="margin-bottom:8px;">Allez dans <strong>Profil → Modifier</strong></li>
            <li style="margin-bottom:8px;">Dans la section Pension, cliquez sur <strong>«&nbsp;Soumettre des photos de vérification&nbsp;»</strong></li>
            <li style="margin-bottom:8px;">Uploadez 3 à 6 photos de votre logement (salon, espace nuit, cuisine, extérieur)</li>
            <li style="margin-bottom:8px;">Notre IA analysera vos photos automatiquement sous quelques minutes</li>
          </ol>
          <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:14px 16px;margin:0 0 16px 0;">
            <strong style="color:#854d0e;">⏰ Délai : 30 jours</strong><br/>
            <span style="color:#713f12;font-size:13px;">
              Si la vérification n'est pas soumise dans les 30 jours, le service Pension sera temporairement désactivé sur votre profil public le temps de la vérification.
            </span>
          </div>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            Cette vérification est rapide, gratuite et automatique. En cas de question, écrivez-nous à
            <a href="mailto:support@dogshift.ch" style="color:#6b7280;">support@dogshift.ch</a>.
          </p>
        </div>
      `,
      ctaLabel: "Vérifier mon logement →",
      ctaUrl: `${APP_URL}/host/profile/edit`,
      footerText: "DogShift · Dog-sitting premium en Suisse · support@dogshift.ch",
    });

    try {
      await sendEmail(
        {
          to: email,
          subject: "Action requise : vérifiez votre logement pour la Pension (30 jours)",
          text: `Bonjour ${firstName},\n\nNous avons mis en place un nouveau système de vérification pour le service Pension.\n\nVous avez 30 jours pour uploader 3 à 6 photos de votre logement via votre espace sitter : ${APP_URL}/host/profile/edit\n\nDogShift`,
          html,
        },
        {
          templateName: "admin-notify-pension-legacy",
          context: "api:admin/notify-pension-legacy",
          metadata: { sitterId: sitter.sitterId },
        },
      );
      results.push({ email, status: "sent" });
    } catch (err) {
      results.push({ email, status: "failed", error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, count: filtered.length, results });
}
