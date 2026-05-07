/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

export const runtime = "nodejs";
// Vercel cron can take longer than the default 10s
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.dogshift.ch").replace(/\/$/, "");

// Inactivity thresholds (in days)
const NUDGE_TO_WARNING1_DAYS = 4;   // 4 days after nudge → warning 1
const WARNING1_TO_WARNING2_DAYS = 3; // 3 days after warning 1 → warning 2
const WARNING2_TO_SUSPEND_DAYS = 2;  // 2 days after warning 2 → suspend

function daysDiff(from: Date, to: Date = new Date()) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function verifyCronSecret(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const fromHeader = req.headers.get("x-cron-secret") || "";
  const secret = authHeader.replace(/^bearer /i, "").trim() || fromHeader.trim();
  if (!CRON_SECRET) return true; // dev: no secret configured
  return secret === CRON_SECRET;
}

// ─── Email builders ──────────────────────────────────────────────────────────

const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
const LOGO_URL = `${APP_URL}/dogshift-logo.png`;

const dot = (color: string) =>
  `<td valign="top" style="padding:8px 10px 0 0;width:10px;"><div style="width:10px;height:10px;border-radius:50%;background:${color};"></div></td>`;
const D_INDIGO = dot("#818cf8");
const D_AMBER  = dot("#fbbf24");
const D_RED    = dot("#f87171");
const D_GREEN  = dot("#4ade80");

function buildNudgeEmail(name: string) {
  return renderEmailLayout({
    logoUrl: LOGO_URL,
    audience: "sitter",
    title: "Ajoutez vos disponibilités pour être visible",
    ctaLabel: "Gérer mes disponibilités",
    ctaUrl: `${APP_URL}/host/availability`,
    footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
    extraHtml: `
      <div style="font-family:${FF};font-size:14px;line-height:22px;color:#374151;">
        <p style="margin:0 0 12px 0;">Bonjour ${name},</p>
        <p style="margin:0 0 16px 0;">
          Votre profil est publié mais vous n'avez pas encore renseigné vos disponibilités.
          Sans disponibilités, les propriétaires ne peuvent pas vous réserver — et votre profil n'apparaît pas dans les recherches.
        </p>
      </div>
      <div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
        <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Pourquoi configurer vos disponibilités</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>${D_INDIGO}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Soyez trouvable</strong> — les propriétaires filtrent par disponibilités, sans créneaux vous êtes invisible.</td></tr>
          <tr>${D_INDIGO}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Recevez des demandes</strong> — chaque créneau activé est une opportunité de réservation supplémentaire.</td></tr>
          <tr>${D_INDIGO}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Deux minutes suffisent</strong> — configurez des règles récurrentes et c'est automatique semaine après semaine.</td></tr>
        </table>
      </div>`,
  });
}

function buildWarning1Email(name: string, daysLeft: number) {
  return renderEmailLayout({
    logoUrl: LOGO_URL,
    audience: "sitter",
    title: "Avertissement — votre compte sera suspendu",
    ctaLabel: "Ajouter mes disponibilités maintenant",
    ctaUrl: `${APP_URL}/host/availability`,
    footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
    extraHtml: `
      <div style="font-family:${FF};font-size:14px;line-height:22px;color:#374151;">
        <p style="margin:0 0 12px 0;">Bonjour ${name},</p>
        <p style="margin:0 0 12px 0;">
          Cela fait plusieurs jours que votre profil est publié sans aucune disponibilité renseignée.
          Les propriétaires ne peuvent pas vous contacter ni vous réserver.
        </p>
        <p style="margin:0 0 16px 0;font-weight:600;color:#b45309;">
          Si vous n'ajoutez pas de disponibilités dans les <strong>${daysLeft} prochains jours</strong>,
          votre compte sera suspendu pour inactivité.
        </p>
      </div>
      <div style="margin-top:20px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:18px 20px;">
        <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#92400e;margin-bottom:12px;">Comment éviter la suspension</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>${D_AMBER}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#78350f;"><strong>Ajoutez vos disponibilités</strong> — connectez-vous et configurez vos créneaux en moins de 2 minutes.</td></tr>
          <tr>${D_AMBER}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#78350f;"><strong>Mettez votre profil en pause</strong> — si vous n'êtes pas disponible actuellement, désactivez-le temporairement depuis vos paramètres.</td></tr>
          <tr>${D_AMBER}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#78350f;"><strong>Besoin d'aide ?</strong> — écrivez-nous à <a href="mailto:support@dogshift.ch" style="color:#92400e;">support@dogshift.ch</a></td></tr>
        </table>
      </div>`,
  });
}

function buildWarning2Email(name: string, daysLeft: number) {
  return renderEmailLayout({
    logoUrl: LOGO_URL,
    audience: "sitter",
    title: "Dernier avertissement — suspension imminente",
    ctaLabel: "Ajouter mes disponibilités maintenant",
    ctaUrl: `${APP_URL}/host/availability`,
    footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
    extraHtml: `
      <div style="font-family:${FF};font-size:14px;line-height:22px;color:#374151;">
        <p style="margin:0 0 12px 0;">Bonjour ${name},</p>
        <p style="margin:0 0 12px 0;">
          C'est votre dernier avertissement. Votre profil est publié depuis plusieurs jours
          sans aucune disponibilité, et les propriétaires ne peuvent pas vous réserver.
        </p>
        <p style="margin:0 0 16px 0;font-weight:600;color:#dc2626;">
          Sans action de votre part dans les <strong>${daysLeft} prochains jours</strong>,
          votre compte sera suspendu automatiquement et votre profil retiré des résultats de recherche.
        </p>
      </div>
      <div style="margin-top:20px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:18px 20px;">
        <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#991b1b;margin-bottom:12px;">Ce qui se passe en cas de suspension</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>${D_RED}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#7f1d1d;"><strong>Profil masqué</strong> — votre fiche n'apparaîtra plus dans les recherches des propriétaires.</td></tr>
          <tr>${D_RED}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#7f1d1d;"><strong>Réactivation manuelle</strong> — vous devrez contacter notre support pour débloquer votre compte.</td></tr>
          <tr>${D_RED}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#7f1d1d;"><strong>Agissez maintenant</strong> — ajoutez vos disponibilités ou mettez votre profil en pause depuis vos paramètres.</td></tr>
        </table>
      </div>`,
  });
}

function buildSuspendedEmail(name: string) {
  return renderEmailLayout({
    logoUrl: LOGO_URL,
    audience: "sitter",
    title: "Votre compte a été suspendu",
    ctaLabel: "Contacter le support",
    ctaUrl: "mailto:support@dogshift.ch",
    footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
    extraHtml: `
      <div style="font-family:${FF};font-size:14px;line-height:22px;color:#374151;">
        <p style="margin:0 0 12px 0;">Bonjour ${name},</p>
        <p style="margin:0 0 12px 0;">
          Votre compte dogsitter a été <strong>suspendu pour inactivité</strong> : votre profil
          était publié depuis plusieurs jours sans aucune disponibilité renseignée.
        </p>
        <p style="margin:0 0 16px 0;">
          Votre profil n'est plus visible dans les résultats de recherche.
        </p>
      </div>
      <div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
        <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Comment réactiver votre compte</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>${D_GREEN}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Contactez notre support</strong> — écrivez à <a href="mailto:support@dogshift.ch" style="color:#2563eb;">support@dogshift.ch</a> en précisant votre adresse e-mail.</td></tr>
          <tr>${D_GREEN}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Ajoutez vos disponibilités</strong> — dès la réactivation, configurez vos créneaux pour rester visible.</td></tr>
          <tr>${D_GREEN}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Utilisez la mise en pause</strong> — si vous avez des périodes sans disponibilité, préférez désactiver temporairement plutôt qu'ignorer.</td></tr>
        </table>
      </div>`,
  });
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const db = prisma as any;
  const now = new Date();

  // Fetch all published + activated sitters
  const sitters = await db.sitterProfile.findMany({
    where: {
      published: true,
      lifecycleStatus: "activated",
    },
    select: {
      id: true,
      sitterId: true,
      displayName: true,
      inactivityStatus: true,
      inactivityNudgeAt: true,
      inactivityWarning1At: true,
      inactivityWarning2At: true,
      user: { select: { email: true, name: true } },
      // Count availability rules inline
      _count: { select: { availabilityRules: true } },
    },
  });

  const results = {
    reset: 0,
    nudge: 0,
    warning1: 0,
    warning2: 0,
    suspended: 0,
    errors: 0,
  };

  for (const sitter of sitters) {
    const email = sitter.user?.email ?? "";
    const name = (sitter.displayName ?? sitter.user?.name ?? "").trim() || "Dogsitter";
    const hasAvailability = sitter._count.availabilityRules > 0;

    try {
      // ── Has availability → reset inactivity tracking ──────────────────
      if (hasAvailability) {
        if (sitter.inactivityStatus) {
          await db.sitterProfile.update({
            where: { id: sitter.id },
            data: {
              inactivityStatus: null,
              inactivityNudgeAt: null,
              inactivityWarning1At: null,
              inactivityWarning2At: null,
              inactivitySuspendedAt: null,
            },
          });
          results.reset++;
        }
        continue;
      }

      // ── No availability — determine what action to take ───────────────

      const status = sitter.inactivityStatus as string | null;

      if (status === "suspended") {
        // Already suspended — nothing to do
        continue;
      }

      if (status === "warning_2" && sitter.inactivityWarning2At) {
        const age = daysDiff(sitter.inactivityWarning2At, now);
        if (age >= WARNING2_TO_SUSPEND_DAYS) {
          // → SUSPEND
          await db.sitterProfile.update({
            where: { id: sitter.id },
            data: {
              inactivityStatus: "suspended",
              inactivitySuspendedAt: now,
              published: false,
            },
          });
          if (email) {
            await sendEmail({
              to: email,
              subject: "Votre compte DogShift a été suspendu",
              text: `Bonjour ${name},\n\nVotre compte a été suspendu pour inactivité. Contactez support@dogshift.ch pour le réactiver.`,
              html: buildSuspendedEmail(name).html,
            }).catch((e) => console.error("[inactivity-check] suspend email failed", e));
          }
          await sendTelegramMessage(
            `[DogShift] 🔴 Compte suspendu (inactivité)\n\nSitter : ${name} (${email})\nID : ${sitter.sitterId}\nAucune disponibilité depuis trop longtemps.`
          ).catch(() => {});
          results.suspended++;
        }
        continue;
      }

      if (status === "warning_1" && sitter.inactivityWarning1At) {
        const age = daysDiff(sitter.inactivityWarning1At, now);
        if (age >= WARNING1_TO_WARNING2_DAYS) {
          // → WARNING 2
          await db.sitterProfile.update({
            where: { id: sitter.id },
            data: { inactivityStatus: "warning_2", inactivityWarning2At: now },
          });
          if (email) {
            await sendEmail({
              to: email,
              subject: "Dernier avertissement — suspension imminente — DogShift",
              text: `Bonjour ${name},\n\nDernier avertissement : votre compte sera suspendu dans ${WARNING2_TO_SUSPEND_DAYS} jours si vous n'ajoutez pas de disponibilités.`,
              html: buildWarning2Email(name, WARNING2_TO_SUSPEND_DAYS).html,
            }).catch((e) => console.error("[inactivity-check] warning2 email failed", e));
          }
          results.warning2++;
        }
        continue;
      }

      if (status === "nudge_sent" && sitter.inactivityNudgeAt) {
        const age = daysDiff(sitter.inactivityNudgeAt, now);
        if (age >= NUDGE_TO_WARNING1_DAYS) {
          // → WARNING 1
          await db.sitterProfile.update({
            where: { id: sitter.id },
            data: { inactivityStatus: "warning_1", inactivityWarning1At: now },
          });
          if (email) {
            await sendEmail({
              to: email,
              subject: "Votre compte sera suspendu — ajoutez vos disponibilités — DogShift",
              text: `Bonjour ${name},\n\nAvertissement : votre compte sera suspendu dans ${WARNING1_TO_WARNING2_DAYS} jours si vous n'ajoutez pas de disponibilités.`,
              html: buildWarning1Email(name, WARNING1_TO_WARNING2_DAYS).html,
            }).catch((e) => console.error("[inactivity-check] warning1 email failed", e));
          }
          results.warning1++;
        }
        continue;
      }

      if (!status) {
        // First time detected — send nudge
        await db.sitterProfile.update({
          where: { id: sitter.id },
          data: { inactivityStatus: "nudge_sent", inactivityNudgeAt: now },
        });
        if (email) {
          await sendEmail({
            to: email,
            subject: "Ajoutez vos disponibilités pour recevoir des réservations — DogShift",
            text: `Bonjour ${name},\n\nVotre profil est publié mais aucune disponibilité n'est renseignée. Connectez-vous pour en ajouter : ${APP_URL}/host/availability`,
              html: buildNudgeEmail(name).html,
          }).catch((e) => console.error("[inactivity-check] nudge email failed", e));
        }
        results.nudge++;
      }
    } catch (err) {
      console.error("[inactivity-check] error for sitter", sitter.sitterId, err);
      results.errors++;
    }
  }

  console.log("[inactivity-check] done", results);
  return NextResponse.json({ ok: true, ...results });
}
