import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { zodParse } from "@/lib/validators/common";
import {
  clerkUserIsExistingSitter,
  emailBelongsToExistingSitter,
} from "@/lib/sitterApplication/existingSitter";
import {
  sitterApplicationApiSchema,
  type SitterApplicationApiBody,
} from "@/lib/sitterApplication/schema";
import {
  DOG_SIZE_VALUES,
  GARDE_EXPERIENCE_LEVEL_VALUES,
  GARDE_TYPE_VALUES,
  HOUSING_TYPE_VALUES,
  LINK_ANIMAL_PROFESSION_VALUES,
  SWISS_NPA_REGEX,
  SWISS_PHONE_REGEX,
  isValidSwissPhone,
  normalizeSwissPhone,
} from "@/lib/sitterApplication/options";

import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";
import { calculateCandidatureScore, buildCandidatureTelegramMessage } from "@/lib/candidature/scoring";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

function isValidEmail(value: string) {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function readIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim() ?? "";
  return first || null;
}

function normalizeString(value: unknown, maxLen: number) {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return "";
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

function normalizeNullableString(value: unknown, maxLen: number) {
  const v = normalizeString(value, maxLen);
  return v ? v : null;
}

function normalizeAge(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return null;
  if (n < 16 || n > 99) return null;
  return n;
}

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

function pickEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<T>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const v = item.trim();
    if ((allowed as readonly string[]).includes(v)) set.add(v as T);
  }
  return [...set];
}

function sanitizeAvailabilityStructured(value: unknown):
  | SitterApplicationApiBody["availabilityStructured"]
  | null {
  if (!value || typeof value !== "object") return null;
  const DAYS = [
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
    "dimanche",
  ] as const;
  const src = value as Record<string, unknown>;
  const out: Record<string, { matin: boolean; apresMidi: boolean; journeeEntiere: boolean }> = {};
  for (const day of DAYS) {
    const slot = src[day];
    if (!slot || typeof slot !== "object") {
      out[day] = { matin: false, apresMidi: false, journeeEntiere: false };
      continue;
    }
    const s = slot as Record<string, unknown>;
    out[day] = {
      matin: Boolean(s.matin),
      apresMidi: Boolean(s.apresMidi),
      journeeEntiere: Boolean(s.journeeEntiere),
    };
  }
  return out;
}

function sanitizeOtherAnimals(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  return {
    none: Boolean(s.none),
    dogs: Boolean(s.dogs),
    cats: Boolean(s.cats),
    others: Boolean(s.others),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const ip = readIp(req) ?? "unknown";
    const rl = checkRateLimit(`sitter-apply:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    // Honeypot: silently succeed for bots that fill the hidden `company` field.
    if (rawBody && typeof rawBody === "object" && (rawBody as Record<string, unknown>).company) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Defensive phone normalisation BEFORE zod validation so legacy clients
    // that send "+41 79 123 45 67" still pass the loose schema but get stored
    // in the canonical +41XXXXXXXXX form.
    if (rawBody && typeof rawBody === "object") {
      const body = rawBody as Record<string, unknown>;
      if (typeof body.phone === "string") {
        body.phone = normalizeSwissPhone(body.phone);
      }
    }

    const parsedBody = zodParse(sitterApplicationApiSchema, rawBody);
    if (!parsedBody.ok) return parsedBody.response;

    const payload = parsedBody.data;

    // Legacy core fields ---------------------------------------------------
    const firstName = normalizeString(payload.firstName, 80);
    const lastName = normalizeString(payload.lastName, 80);
    const city = normalizeString(payload.city, 120);
    const email = normalizeString(payload.email, 200).toLowerCase();
    const phone = normalizeString(payload.phone, 60);

    const age = normalizeAge(payload.age);

    const experienceText = normalizeString(payload.experienceText, 5000);
    const hasDogExperience = payload.hasDogExperience === true;
    const motivationText = normalizeString(payload.motivationText, 5000);
    const availabilityText = normalizeString(payload.availabilityText, 3000);

    const consentInterview = payload.consentInterview === true;
    const consentPrivacy = payload.consentPrivacy === true;

    // Tracking -------------------------------------------------------------
    const utmSource = normalizeNullableString(payload.utmSource, 120);
    const utmMedium = normalizeNullableString(payload.utmMedium, 120);
    const utmCampaign = normalizeNullableString(payload.utmCampaign, 120);
    const utmContent = normalizeNullableString(payload.utmContent, 120);
    const utmTerm = normalizeNullableString(payload.utmTerm, 120);
    const referrer = normalizeNullableString(payload.referrer, 500);

    // Structured fields (all optional; null when not provided) -------------
    const npaRaw = normalizeNullableString(payload.npa, 4);
    const npa = npaRaw && SWISS_NPA_REGEX.test(npaRaw) ? npaRaw : null;

    const cityOther = normalizeNullableString(payload.cityOther, 120);
    const linkAnimalProfession = pickEnum(
      payload.linkAnimalProfession,
      LINK_ANIMAL_PROFESSION_VALUES,
    );
    const linkAnimalProfessionOther = normalizeNullableString(
      payload.linkAnimalProfessionOther,
      200,
    );
    const gardeExperienceLevel = pickEnum(
      payload.gardeExperienceLevel,
      GARDE_EXPERIENCE_LEVEL_VALUES,
    );
    const availabilityStructured = sanitizeAvailabilityStructured(
      payload.availabilityStructured,
    );
    const gardeTypes = pickEnumArray(payload.gardeTypes, GARDE_TYPE_VALUES);
    const dogSizes = pickEnumArray(payload.dogSizes, DOG_SIZE_VALUES);
    const housingType = pickEnum(payload.housingType, HOUSING_TYPE_VALUES);
    const housingTypeOther = normalizeNullableString(
      payload.housingTypeOther,
      200,
    );
    const otherAnimals = sanitizeOtherAnimals(payload.otherAnimals);
    const otherAnimalsDogCount =
      payload.otherAnimalsDogCount != null &&
      Number.isFinite(payload.otherAnimalsDogCount) &&
      payload.otherAnimalsDogCount >= 1 &&
      payload.otherAnimalsDogCount <= 20
        ? payload.otherAnimalsDogCount
        : null;
    const hasCarLicense =
      typeof payload.hasCarLicense === "boolean" ? payload.hasCarLicense : null;
    const allergies = normalizeNullableString(payload.allergies, 500);

    // ----- Core validation (French messages kept) -------------------------
    if (!firstName || !lastName || !city || !email || !phone) {
      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS", message: "Merci de remplir tous les champs requis." },
        { status: 400 },
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_EMAIL", message: "Email invalide." },
        { status: 400 },
      );
    }
    // Strict Swiss phone required for new submissions. Legacy rows remain
    // unchanged in DB.
    if (!isValidSwissPhone(phone) && !SWISS_PHONE_REGEX.test(phone)) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_PHONE",
          message: "Numéro suisse requis au format +41 79 123 45 67.",
        },
        { status: 400 },
      );
    }
    if (!experienceText || !motivationText || !availabilityText) {
      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS", message: "Merci de compléter les champs de texte." },
        { status: 400 },
      );
    }
    if (!consentInterview || !consentPrivacy) {
      return NextResponse.json(
        { ok: false, error: "CONSENT_REQUIRED", message: "Merci d'accepter les consentements." },
        { status: 400 },
      );
    }

    // ----- Block already-activated dog-sitters ----------------------------
    // Either the caller is signed in with a sitter account, or the submitted
    // email already belongs to a sitter user. Both paths short-circuit with
    // a French 409 so the client form can display a tailored message.
    try {
      const { userId: clerkUserId } = await auth();
      if (clerkUserId) {
        const { isSitter } = await clerkUserIsExistingSitter(clerkUserId);
        if (isSitter) {
          return NextResponse.json(
            {
              ok: false,
              error: "ALREADY_SITTER",
              message:
                "Tu es déjà dog-sitter DogShift. Inutile de postuler à nouveau — connecte-toi à ton espace sitter.",
            },
            { status: 409 },
          );
        }
      }
    } catch (err) {
      // Clerk session lookup failing must never block a legitimate submission
      // — fall through to the email-based check below.
      console.warn("[api][sitter-applications] clerk auth lookup failed", err);
    }

    try {
      const emailIsSitter = await emailBelongsToExistingSitter(email);
      if (emailIsSitter) {
        return NextResponse.json(
          {
            ok: false,
            error: "ALREADY_SITTER",
            message:
              "Cette adresse email correspond déjà à un dog-sitter DogShift. Connecte-toi à ton espace sitter ou utilise une autre adresse.",
          },
          { status: 409 },
        );
      }
    } catch (err) {
      console.warn("[api][sitter-applications] sitter lookup by email failed", err);
    }

    const idempotencyKey = (req.headers.get("x-idempotency-key") ?? "").trim() || null;
    const userAgent = normalizeNullableString(req.headers.get("user-agent"), 500);

    const db = prisma as unknown as {
      pilotSitterApplication: {
        create: (args: unknown) => Promise<{ id: string; email: string; firstName: string }>;
      };
    };

    // DB insert — isolated so a duplicate never blocks scoring/email/Telegram
    let applicationId: string | null = null;
    try {
      const created = await db.pilotSitterApplication.create({
        data: {
          firstName, lastName, city, email, phone, age,
          experienceText, hasDogExperience, motivationText, availabilityText,
          consentInterview, consentPrivacy,
          npa, cityOther, linkAnimalProfession, linkAnimalProfessionOther,
          gardeExperienceLevel, availabilityStructured: availabilityStructured ?? undefined,
          gardeTypes, dogSizes, housingType, housingTypeOther,
          otherAnimals: otherAnimals ?? undefined, otherAnimalsDogCount,
          hasCarLicense, allergies,
          utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
          referrer, userAgent, ip, idempotencyKey,
        },
        select: { id: true },
      });
      applicationId = created.id;
    } catch (dbErr) {
      // Duplicate or other DB error — still run scoring/email/Telegram below
      console.warn("[api][sitter-applications] db insert failed (duplicate?)", dbErr);
    }

    // Audit: consentements acceptés lors de la candidature
    if (applicationId) {
      void logAudit({
        action: "consent.application",
        actorType: "user",
        targetId: applicationId,
        targetType: "PILOT_SITTER_APPLICATION",
        metadata: { consentInterview, consentPrivacy, ip },
      });
    }

    // ---------------------------------------------------------------
    // Inline processing — always runs, even on duplicate submissions.
    // No HTTP self-calls (unreliable on Vercel).
    // ---------------------------------------------------------------

    const scoringStart = performance.now();

    // 1. Score
    const scoreResult = calculateCandidatureScore({
      firstName, lastName, email, phone, city, cityOther, npa,
      linkAnimalProfession, gardeExperienceLevel,
      experience: experienceText, motivation: motivationText,
      availabilityStructured: availabilityStructured ?? null,
      gardeTypes, dogSizes, hasCarLicense,
      applicationId: applicationId ?? undefined,
    });

    // 2. Log
    if (applicationId) {
      try {
        await prisma.agentLog.create({
          data: {
            agentName: "candidature",
            actionType: "apply",
            summary: `Candidature ${firstName} ${lastName} → ${scoreResult.decision} (${scoreResult.score}/100)`,
            details: { email, decision: scoreResult.decision, score: scoreResult.score },
            targetId: applicationId,
            durationMs: Math.round(performance.now() - scoringStart),
            status: "success",
          },
        });
      } catch (err) {
        console.warn("[api][sitter-applications] agent log failed", err);
      }
    }

    // 3. Telegram
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "977094430";
    if (TELEGRAM_BOT_TOKEN) {
      try {
        const msg = buildCandidatureTelegramMessage({ firstName, lastName, city, email, result: scoreResult });
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "Markdown" }),
        });
      } catch (err) {
        console.warn("[api][sitter-applications] telegram failed", err);
      }
    }

    // 4. Confirmation email
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
    try {
      const { html } = renderEmailLayout({
        title: `Candidature reçue, ${firstName} !`,
        subtitle: "Nous avons bien reçu ta candidature pour devenir dog-sitter DogShift.",
        summaryTitle: "Prochaines étapes",
        summaryRows: [
          { label: "1. Analyse", value: "Nous analysons ton profil avec soin. Cette étape prend généralement 2 à 5 jours ouvrés." },
          { label: "2. Contact", value: "Si ton profil correspond à nos critères, nous te contactons pour un mini entretien de validation." },
          { label: "3. Activation", value: "Une fois validé, ton profil est activé et tu peux commencer à recevoir des demandes de garde." },
        ],
        ctaLabel: "Voir ma candidature →",
        ctaUrl: baseUrl,
        footerText: "Tu reçois cet email car tu as postulé pour devenir dog-sitter sur dogshift.ch. DogShift • support@dogshift.ch",
        footerLinks: [{ label: "dogshift.ch", url: baseUrl }],
      });
      await sendEmail({
        to: email,
        subject: "Ta candidature DogShift a bien été reçue",
        text: `Bonjour ${firstName},\n\nNous avons bien reçu ta candidature pour devenir dog-sitter DogShift.\n\nNous l'analysons avec soin et te recontactons sous 2 à 5 jours ouvrés si ton profil correspond à nos critères.\n\n— L'équipe DogShift\nhttps://www.dogshift.ch`,
        html,
      });
    } catch (err) {
      console.warn("[api][sitter-applications] confirmation email failed", err);
    }

    return NextResponse.json({ ok: true, id: applicationId, score: scoreResult.score, decision: scoreResult.decision }, { status: 200 });
  } catch (err: unknown) {
    console.error("[api][sitter-applications][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
