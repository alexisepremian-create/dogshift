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

function buildNudgeEmail(name: string) {
  return renderEmailLayout({
    title: "Ajoutez vos disponibilités pour être visible",
    subtitle: `Bonjour ${name},`,
    ctaLabel: "Gérer mes disponibilités",
    ctaUrl: `${APP_URL}/host/availability`,
    footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
    extraHtml: `
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
        Votre profil est publié mais vous n'avez pas encore renseigné vos disponibilités.
        Sans disponibilités, les propriétaires ne peuvent pas vous réserver.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
        Prenez deux minutes pour indiquer vos créneaux disponibles — c'est rapide et ça fait toute la différence !
      </p>
    `,
  });
}

function buildWarning1Email(name: string, daysLeft: number) {
  return renderEmailLayout({
    title: "⚠️ Avertissement — votre compte sera suspendu",
    subtitle: `Bonjour ${name},`,
    ctaLabel: "Ajouter mes disponibilités maintenant",
    ctaUrl: `${APP_URL}/host/availability`,
    footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
    extraHtml: `
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
        Cela fait plusieurs jours que votre profil est publié sans aucune disponibilité renseignée.
        Les propriétaires ne peuvent pas vous contacter ni vous réserver.
      </p>
      <p style="color:#b45309;font-size:15px;font-weight:600;line-height:1.6;margin:16px 0">
        Si vous n'ajoutez pas de disponibilités dans les ${daysLeft} prochains jours,
        votre compte sera suspendu pour inactivité.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
        Si vous souhaitez mettre votre profil en pause temporairement, vous pouvez le désactiver
        depuis vos paramètres — cela évite toute suspension automatique.
      </p>
    `,
  });
}

function buildWarning2Email(name: string, daysLeft: number) {
  return renderEmailLayout({
    title: "🚨 Dernier avertissement — suspension imminente",
    subtitle: `Bonjour ${name},`,
    ctaLabel: "Ajouter mes disponibilités maintenant",
    ctaUrl: `${APP_URL}/host/availability`,
    footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
    extraHtml: `
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
        C'est votre dernier avertissement. Votre profil est publié depuis plusieurs jours
        sans aucune disponibilité, et les propriétaires ne peuvent pas vous réserver.
      </p>
      <p style="color:#dc2626;font-size:15px;font-weight:600;line-height:1.6;margin:16px 0">
        Sans action de votre part dans les ${daysLeft} prochains jours,
        votre compte sera suspendu automatiquement pour inactivité.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
        En cas de suspension, vous devrez contacter notre support pour débloquer votre compte.
      </p>
    `,
  });
}

function buildSuspendedEmail(name: string) {
  return renderEmailLayout({
    title: "Votre compte a été suspendu",
    subtitle: `Bonjour ${name},`,
    ctaLabel: "Contacter le support",
    ctaUrl: `mailto:support@dogshift.ch`,
    footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
    extraHtml: `
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
        Votre compte dogsitter a été <strong>suspendu pour inactivité</strong> : votre profil
        était publié depuis plusieurs jours sans aucune disponibilité renseignée.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
        Votre profil n'est plus visible dans les résultats de recherche.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
        Pour réactiver votre compte, contactez-nous à
        <a href="mailto:support@dogshift.ch" style="color:#2563eb">support@dogshift.ch</a>
        en précisant votre adresse e-mail et la raison de votre inactivité.
      </p>
    `,
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
              html: buildSuspendedEmail(name),
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
              subject: "🚨 Dernier avertissement — suspension imminente — DogShift",
              text: `Bonjour ${name},\n\nDernier avertissement : votre compte sera suspendu dans ${WARNING2_TO_SUSPEND_DAYS} jours si vous n'ajoutez pas de disponibilités.`,
              html: buildWarning2Email(name, WARNING2_TO_SUSPEND_DAYS),
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
              subject: "⚠️ Votre compte sera suspendu — ajoutez vos disponibilités — DogShift",
              text: `Bonjour ${name},\n\nAvertissement : votre compte sera suspendu dans ${WARNING1_TO_WARNING2_DAYS} jours si vous n'ajoutez pas de disponibilités.`,
              html: buildWarning1Email(name, WARNING1_TO_WARNING2_DAYS),
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
            html: buildNudgeEmail(name),
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
