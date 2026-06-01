/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pension verification agent logic — shared between submit route and admin re-trigger.
 * Runs AI analysis on pension photos, sends result email to sitter.
 */

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { presignGetObject } from "@/lib/r2";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");

const PensionVerifSchema = z.object({
  verdict: z.enum(["approved", "rejected"]).describe("Décision finale"),
  score: z.number().describe("Score global de 0 à 100"),
  criteria: z.object({
    espaceSuffisant: z.number().describe("Espace suffisant pour un chien, note de 0 à 5"),
    hygiene: z.number().describe("Propreté et hygiène, note de 0 à 5"),
    securite: z.number().describe("Absence de dangers visibles, note de 0 à 5"),
    adequatChien: z.number().describe("Environnement adapté à un chien, note de 0 à 5"),
    coherenceDeclaration: z.number().describe("Cohérence avec le type de logement déclaré, note de 0 à 5"),
  }),
  forces: z.array(z.string()).describe("Points positifs observés, maximum 3"),
  problemes: z.array(z.string()).describe("Problèmes ou points d'attention, maximum 5"),
  recommandation: z.string().describe("Recommandation détaillée pour l'admin"),
});

/** Summarise EXIF metadata for the AI prompt */
function buildExifSummary(exifData: Record<string, unknown>[]): string {
  if (!exifData.length) return "Aucune métadonnée EXIF disponible (photos potentiellement issues d'internet ou EXIF supprimé).";

  const lines: string[] = [];
  exifData.forEach((exif, i) => {
    const parts: string[] = [];
    if (exif.Make || exif.Model) parts.push(`Appareil: ${[exif.Make, exif.Model].filter(Boolean).join(" ")}`);
    if (exif.DateTimeOriginal) parts.push(`Date prise: ${exif.DateTimeOriginal}`);
    else if (exif.CreateDate) parts.push(`Date: ${exif.CreateDate}`);
    else parts.push("Date: inconnue");
    if (exif.GPSLatitude) parts.push("GPS: présent");
    else parts.push("GPS: absent");
    if (exif.Software) parts.push(`Logiciel: ${exif.Software}`);
    lines.push(`Photo ${i + 1}: ${parts.join(" | ")}`);
  });
  return lines.join("\n");
}

export async function runPensionVerificationAgent(params: {
  sitterId: string;
  sitterName: string;
  sitterEmail: string;
  exifData?: Record<string, unknown>[];
}) {
  const { sitterId, sitterName, sitterEmail, exifData = [] } = params;
  const db = prisma as any;

  try {
    const profile = await db.sitterProfile.findFirst({
      where: { sitterId },
      select: {
        id: true,
        pensionPhotoUrls: true,
        user: { select: { hostProfileJson: true } },
      },
    });

    if (!profile) {
      console.error("[pensionVerificationAgent] profile not found", sitterId);
      return;
    }

    const photoKeys: string[] = Array.isArray(profile.pensionPhotoUrls) ? profile.pensionPhotoUrls : [];
    if (photoKeys.length < 3) {
      console.error("[pensionVerificationAgent] insufficient photos", sitterId);
      return;
    }

    // Mark as ai_reviewing
    await db.sitterProfile.update({
      where: { id: profile.id },
      data: { pensionVerifStatus: "ai_reviewing" },
    });

    // Fetch photos as base64
    const imageContents: { type: "image"; image: string; mimeType: string }[] = [];
    for (const key of photoKeys.slice(0, 6)) {
      try {
        const { url } = await presignGetObject({ key, expiresInSeconds: 120 });
        const imgRes = await fetch(url);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const b64 = Buffer.from(buffer).toString("base64");
          const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
          imageContents.push({ type: "image", image: b64, mimeType: ct.split(";")[0].trim() });
        }
      } catch {
        // skip failed images
      }
    }

    if (imageContents.length === 0) {
      await db.sitterProfile.update({
        where: { id: profile.id },
        data: { pensionVerifStatus: "ai_needs_review" },
      });
      console.error("[pensionVerificationAgent] no photos available — forcing manual review", sitterId);
      if (sitterEmail) {
        await sendPensionResultEmail({ sitterEmail, sitterName, finalStatus: "ai_needs_review", score: 0 });
      }
      await sendTelegramMessage(
        `[DogShift] Vérification Pension — révision manuelle requise\n\nSitter : ${sitterName || sitterId}\nRaison : Impossible de charger les photos depuis R2.\n\nRevoir : ${APP_URL}/admin/pension-verifications`,
        { bot: "verifications" }
      );
      return;
    }

    const exifSummary = buildExifSummary(exifData);

    // Extract boarding details from hostProfileJson for coherence check
    let boardingContext = "Non renseigné.";
    try {
      const raw = typeof profile.user?.hostProfileJson === "string" ? profile.user.hostProfileJson : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const bd = parsed?.boardingDetails as Record<string, unknown> | undefined;
        if (bd) {
          const parts: string[] = [];
          if (bd.housingType) parts.push(`Type : ${bd.housingType}`);
          if (bd.hasGarden) parts.push("Jardin : oui");
          if (bd.hasOtherPets) parts.push("Autres animaux : oui");
          if (bd.notes) parts.push(`Notes : ${bd.notes}`);
          if (parts.length) boardingContext = parts.join(" | ");
        }
      }
    } catch { /* ignore */ }

    const { object: analyse } = await generateObject({
      model: anthropic("claude-sonnet-4-5"),
      schema: PensionVerifSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Tu es un expert en sécurité pour DogShift, plateforme de dogsitting premium en Suisse romande.

Analyse ces ${imageContents.length} photos du logement d'un sitter qui veut activer l'option Pension (garde à domicile de chiens chez lui).

MÉTADONNÉES EXIF DES PHOTOS :
${exifSummary}

LOGEMENT DÉCLARÉ PAR LE SITTER :
${boardingContext}

Vérifie que les photos correspondent bien à ce qui est déclaré (ex: si "Maison" est déclaré mais les photos montrent clairement un appartement en hauteur, pénalise la cohérence).

CRITÈRES D'ÉVALUATION (score 0-5 par critère) :
1. Espace suffisant : le chien aura de la place pour se déplacer, pas d'encombrement excessif
2. Hygiène : logement visiblement propre, pas de saleté apparente
3. Sécurité : absence d'éléments dangereux visibles (câbles traînants, produits chimiques accessibles, hauteurs non sécurisées, balcons sans barrières pour un chien)
4. Adéquat pour un chien : présence d'espaces confortables, lumière naturelle, pas d'environnement hostile
5. Cohérence : les photos sont réalistes et correspondent à un vrai logement habité

Sois objectif et bienveillant mais rigoureux sur la sécurité.`,
            },
            ...imageContents,
          ],
        },
      ],
    });

    // Hard EXIF rule: if no photo has a device Make/Model, force manual review
    // regardless of AI score — a real phone photo almost always has Make+Model.
    const hasAnyDeviceExif = exifData.some(
      (e) => (typeof e.Make === "string" && e.Make.trim()) || (typeof e.Model === "string" && e.Model.trim())
    );
    const noExifOverride = exifData.length > 0 && !hasAnyDeviceExif;

    const finalStatus =
      noExifOverride
        ? "ai_needs_review" // force admin review when all photos lack device EXIF
        : analyse.score >= 75
        ? "approved"
        : analyse.score >= 50
        ? "ai_needs_review"
        : "ai_rejected";

    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        pensionVerifStatus: finalStatus,
        pensionAiScore: analyse.score,
        pensionAiVerdict: analyse.verdict,
        pensionAiReasoning: { ...analyse, noExifOverride },
        pensionAiReviewedAt: new Date(),
        pensionPhotoReviewedAt: new Date(),
      },
    });

    // Send result email to sitter
    if (sitterEmail) {
      await sendPensionResultEmail({ sitterEmail, sitterName, finalStatus, score: analyse.score });
    }

    // Telegram alert for cases requiring manual admin review
    if (finalStatus === "ai_needs_review") {
      const reason = noExifOverride
        ? "Aucune photo n'a de métadonnée EXIF appareil — vérification manuelle obligatoire."
        : `Score IA : ${analyse.score}/100 (zone 50–74, révision requise).`;
      await sendTelegramMessage(
        `[DogShift] Vérification Pension — révision manuelle requise\n\nSitter : ${sitterName || sitterId}\nScore IA : ${analyse.score}/100\n${reason}\n\nRevoir : ${APP_URL}/admin/pension-verifications`,
        { bot: "verifications" }
      );
    }

    console.log("[pensionVerificationAgent] done", { sitterId, finalStatus, score: analyse.score });
  } catch (err) {
    console.error("[pensionVerificationAgent] error", sitterId, err);
    try {
      await db.sitterProfile.update({
        where: { sitterId },
        data: { pensionVerifStatus: "ai_needs_review" },
      });
      if (sitterEmail) {
        await sendPensionResultEmail({ sitterEmail, sitterName, finalStatus: "ai_needs_review", score: 0 });
      }
      await sendTelegramMessage(
        `[DogShift] Vérification Pension — ERREUR AGENT\n\nSitter : ${sitterName || sitterId}\nErreur : ${String(err).slice(0, 200)}\n\nRevoir manuellement : ${APP_URL}/admin/pension-verifications`,
        { bot: "verifications" }
      );
    } catch (fallbackErr) {
      console.error("[pensionVerificationAgent] fallback also failed", sitterId, fallbackErr);
    }
  }
}

export async function sendPensionResultEmail(params: {
  sitterEmail: string;
  sitterName: string;
  finalStatus: string;
  score?: number;
}) {
  const { sitterEmail, sitterName, finalStatus } = params;
  // Derive first name; use empty string as fallback so greeting stays "Bonjour," without duplication
  const firstName = sitterName.trim().split(/\s+/)[0] || "";

  const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
  const DG = `<td valign="top" style="padding:8px 10px 0 0;width:10px;"><div style="width:10px;height:10px;border-radius:50%;background:#4ade80;"></div></td>`;
  const DR = `<td valign="top" style="padding:8px 10px 0 0;width:10px;"><div style="width:10px;height:10px;border-radius:50%;background:#f87171;"></div></td>`;
  const DI = `<td valign="top" style="padding:8px 10px 0 0;width:10px;"><div style="width:10px;height:10px;border-radius:50%;background:#818cf8;"></div></td>`;
  const logoUrl = `${APP_URL}/dogshift-logo.png`;

  let subject: string;
  let bodyHtml: string;
  let bodyText: string;

  if (finalStatus === "approved") {
    subject = "Votre logement est approuvé — Pension activée";
    bodyHtml = `
      <div style="font-family:${FF};font-size:14px;line-height:22px;color:#374151;">
        <p style="margin:0 0 12px 0;">Bonne nouvelle${firstName ? `, ${firstName}` : ""} !</p>
        <p style="margin:0 0 16px 0;">
          Notre équipe a examiné vos photos et votre logement répond à nos critères de qualité.
          Le service <strong>Pension</strong> est maintenant <strong style="color:#059669;">actif</strong> sur votre profil public.
        </p>
      </div>
      <div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
        <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Prochaines étapes</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>${DG}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Configurez vos disponibilités</strong> — activez les créneaux Pension pour commencer à recevoir des demandes.</td></tr>
          <tr>${DG}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Précisez les tailles acceptées</strong> — indiquez les gabarits de chiens que vous pouvez accueillir.</td></tr>
          <tr>${DG}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Complétez votre profil</strong> — une photo récente et une description détaillée rassurent les propriétaires.</td></tr>
        </table>
      </div>`;
    bodyText = `Bonne nouvelle${firstName ? ` ${firstName}` : ""} ! Notre équipe a approuvé votre logement. La Pension est maintenant active sur votre profil. Pensez à configurer vos disponibilités.`;

  } else if (finalStatus === "ai_needs_review") {
    subject = "Vos photos sont en cours d'examen — Pension";
    bodyHtml = `
      <div style="font-family:${FF};font-size:14px;line-height:22px;color:#374151;">
        <p style="margin:0 0 12px 0;">Bonjour${firstName ? ` ${firstName}` : ""},</p>
        <p style="margin:0 0 12px 0;">
          Nous avons bien reçu vos photos et notre équipe les examine actuellement.
          Vous recevrez une réponse définitive dans les <strong>48 heures ouvrées</strong>.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Si vous avez des questions : <a href="mailto:support@dogshift.ch" style="color:#6b7280;">support@dogshift.ch</a>
        </p>
      </div>
      <div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
        <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">En attendant</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>${DI}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Complétez votre profil</strong> — préparez votre description et vos disponibilités.</td></tr>
          <tr>${DI}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Aucune action requise</strong> — nous vous notifierons dès que la vérification sera terminée.</td></tr>
        </table>
      </div>`;
    bodyText = `Bonjour${firstName ? ` ${firstName}` : ""}, notre équipe examine vos photos. Vous recevrez une réponse dans les 48 heures ouvrées.`;

  } else {
    subject = "Photos de vérification non retenues — Pension";
    bodyHtml = `
      <div style="font-family:${FF};font-size:14px;line-height:22px;color:#374151;">
        <p style="margin:0 0 12px 0;">Bonjour${firstName ? ` ${firstName}` : ""},</p>
        <p style="margin:0 0 16px 0;">
          Après examen de vos photos, notre équipe n'a pas pu valider votre logement pour le service Pension.
          Vous pouvez soumettre de nouvelles photos à tout moment.
        </p>
      </div>
      <div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
        <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Conseils pour améliorer vos photos</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>${DR}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Pièces principales</strong> — photographiez le salon, la chambre et la cuisine.</td></tr>
          <tr>${DR}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Luminosité et ordre</strong> — logement bien éclairé et rangé pour une meilleure impression.</td></tr>
          <tr>${DR}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Espace pour le chien</strong> — montrez où le chien pourra dormir et se déplacer.</td></tr>
          <tr>${DR}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Extérieur</strong> — incluez une vue du jardin ou de la terrasse si vous en avez un(e).</td></tr>
        </table>
      </div>`;
    bodyText = `Bonjour${firstName ? ` ${firstName}` : ""}, nos équipes n'ont pas pu valider votre logement. Vous pouvez soumettre de nouvelles photos depuis votre profil : ${APP_URL}/host/profile/edit`;
  }

  const { html } = renderEmailLayout({
    logoUrl,
    audience: "sitter",
    title: subject,
    extraHtml: bodyHtml,
    ctaLabel: "Voir mon profil",
    ctaUrl: `${APP_URL}/host/profile/edit`,
    footerText: "DogShift · Dog-sitting premium en Suisse · support@dogshift.ch",
  });

  await sendEmail(
    { to: sitterEmail, subject, html, text: bodyText },
    {
      templateName: "sitter-pension-verification-reviewed",
      context: "lib:pensionVerificationAgent",
      metadata: { finalStatus, score: params.score ?? null },
    },
  );
}
