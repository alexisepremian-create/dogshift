import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email/sendEmail";
import { CGU_VERSION } from "@/lib/cguVersion";

export const runtime = "nodejs";

// Délai entre chaque envoi pour éviter le rate-limiting Resend (max 2 req/s sur plan gratuit)
const DELAY_MS = 600;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEmailHtml(firstName: string, customMessage: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
    
    <!-- Header -->
    <div style="background:#2f4d6b;padding:28px 32px;">
      <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">DogShift</p>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Dog-sitting premium en Suisse</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#1e293b;font-size:15px;">Bonjour ${firstName},</p>

      <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
        Nous avons mis à jour nos <strong style="color:#1e293b;">Conditions Générales d'Utilisation</strong> 
        et notre <strong style="color:#1e293b;">Politique de confidentialité</strong>.
      </p>

      ${customMessage ? `
      <div style="margin:20px 0;padding:16px 20px;background:#f1f5f9;border-radius:10px;border-left:3px solid #2f4d6b;">
        <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">${customMessage.replace(/\n/g, "<br>")}</p>
      </div>
      ` : ""}

      <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
        La prochaine fois que vous vous connectez sur DogShift, un bandeau apparaîtra en haut de la page 
        pour vous demander de relire et d'accepter les nouvelles conditions.
      </p>

      <!-- CTA buttons -->
      <div style="margin:28px 0;display:flex;gap:12px;">
        <a href="https://www.dogshift.ch/cgu" 
           style="display:inline-block;background:#2f4d6b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
          Lire les CGU
        </a>
        <a href="https://www.dogshift.ch/confidentialite" 
           style="display:inline-block;background:#f1f5f9;color:#2f4d6b;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-left:8px;">
          Confidentialité
        </a>
      </div>

      <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.5;">
        Si vous avez des questions, répondez simplement à cet email ou contactez-nous à 
        <a href="mailto:support@dogshift.ch" style="color:#2f4d6b;">support@dogshift.ch</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f8f9fc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        DogShift · <a href="https://www.dogshift.ch/cgu" style="color:#94a3b8;">CGU</a> · 
        <a href="https://www.dogshift.ch/confidentialite" style="color:#94a3b8;">Confidentialité</a> · 
        <a href="https://www.dogshift.ch/mentions-legales" style="color:#94a3b8;">Mentions légales</a>
      </p>
      <p style="margin:4px 0 0;color:#cbd5e1;font-size:11px;">Version CGU : ${CGU_VERSION}</p>
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(firstName: string, customMessage: string) {
  return [
    `Bonjour ${firstName},`,
    "",
    "Nous avons mis à jour nos Conditions Générales d'Utilisation et notre Politique de confidentialité.",
    "",
    ...(customMessage ? [customMessage, ""] : []),
    "La prochaine fois que vous vous connectez sur DogShift, un bandeau apparaîtra pour vous demander d'accepter les nouvelles conditions.",
    "",
    "Lire les CGU : https://www.dogshift.ch/cgu",
    "Politique de confidentialité : https://www.dogshift.ch/confidentialite",
    "",
    "L'équipe DogShift",
    "support@dogshift.ch",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const admin = await getRequestAdminAccess(req);
  if (!admin.isAdmin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { customMessage?: string; preview?: boolean } | null;
  const customMessage = typeof body?.customMessage === "string" ? body.customMessage.trim() : "";
  const previewOnly = body?.preview === true;

  // Mode preview : retourne juste le HTML sans envoyer
  if (previewOnly) {
    return NextResponse.json({
      ok: true,
      html: buildEmailHtml("Prénom", customMessage),
      text: buildEmailText("Prénom", customMessage),
    });
  }

  // Récupère tous les utilisateurs Clerk (paginé par 100)
  const clerk = await clerkClient();
  const allUsers: { email: string; firstName: string }[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const page = await clerk.users.getUserList({ limit, offset });
    for (const u of page.data) {
      const email = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress;
      if (email) {
        allUsers.push({ email, firstName: u.firstName ?? "Membre" });
      }
    }
    if (page.data.length < limit) break;
    offset += limit;
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of allUsers) {
    try {
      await sendEmail({
        to: user.email,
        subject: `Mise à jour de nos Conditions Générales d'Utilisation — DogShift`,
        text: buildEmailText(user.firstName, customMessage),
        html: buildEmailHtml(user.firstName, customMessage),
      });
      sent++;
    } catch (err) {
      failed++;
      errors.push(`${user.email}: ${err instanceof Error ? err.message : "unknown"}`);
      console.error("[admin][notify-users] send failed", { email: user.email, err });
    }

    // Respecter le rate-limit Resend
    if (allUsers.indexOf(user) < allUsers.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log("[admin][notify-users] done", { sent, failed, total: allUsers.length });

  return NextResponse.json({ ok: true, total: allUsers.length, sent, failed, errors });
}
