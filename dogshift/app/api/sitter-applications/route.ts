import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { render } from "@react-email/render";
import { checkRateLimit } from "@/lib/rateLimit";
import { baseUrlFromRequest } from "@/lib/url/baseUrlFromRequest";
import { zodParse } from "@/lib/validators/common";
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

import {
  PilotSitterApplicationConfirmationEmail,
  pilotSitterApplicationConfirmationCtaUrl,
  pilotSitterApplicationConfirmationPlainText,
} from "@/lib/email/templates/pilotSitterApplicationConfirmation";
import {
  buildApplicationScoringPayload,
  triggerApplicationScoring,
} from "@/lib/integrations/triggerApplicationScoring";

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

    const idempotencyKey = (req.headers.get("x-idempotency-key") ?? "").trim() || null;
    const userAgent = normalizeNullableString(req.headers.get("user-agent"), 500);

    const db = prisma as unknown as {
      pilotSitterApplication: {
        create: (args: unknown) => Promise<{ id: string; email: string; firstName: string }>;
      };
    };

    const created = await db.pilotSitterApplication.create({
      data: {
        // Legacy / required
        firstName,
        lastName,
        city,
        email,
        phone,
        age,
        experienceText,
        hasDogExperience,
        motivationText,
        availabilityText,
        consentInterview,
        consentPrivacy,

        // Structured (all nullable / defaulted in schema)
        npa,
        cityOther,
        linkAnimalProfession,
        linkAnimalProfessionOther,
        gardeExperienceLevel,
        availabilityStructured: availabilityStructured ?? undefined,
        gardeTypes,
        dogSizes,
        housingType,
        housingTypeOther,
        otherAnimals: otherAnimals ?? undefined,
        otherAnimalsDogCount,
        hasCarLicense,
        allergies,

        // Tracking
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        referrer,
        userAgent,
        ip,
        idempotencyKey,
      },
      select: { id: true, email: true, firstName: true },
    });

    // Best-effort push to the external n8n scoring workflow. Must never
    // block or fail the application creation — if n8n is down, the
    // candidate is still saved and will receive the generic confirmation
    // email below.
    try {
      const scoringPayload = buildApplicationScoringPayload({
        applicationId: created.id,
        firstName,
        lastName,
        email,
        phone,
        city,
        cityOther,
        npa,
        linkAnimalProfession,
        linkAnimalProfessionOther,
        gardeExperienceLevel,
        experienceText,
        motivationText,
        availabilityStructured: availabilityStructured ?? null,
        gardeTypes,
        dogSizes,
        housingType,
        hasCarLicense,
      });
      const result = await triggerApplicationScoring(scoringPayload);
      if (!result.ok && result.reason !== "disabled") {
        console.warn("[api][sitter-applications] n8n scoring trigger failed", {
          applicationId: created.id,
          reason: result.reason,
          detail: result.detail,
        });
      }
    } catch (err) {
      console.warn("[api][sitter-applications] n8n scoring trigger threw", err);
    }

    // Best-effort confirmation email (does not block application creation).
    try {
      const baseUrl = baseUrlFromRequest(req);
      const ctaUrl = pilotSitterApplicationConfirmationCtaUrl(baseUrl);
      const text = pilotSitterApplicationConfirmationPlainText({ firstName: created.firstName, ctaUrl });
      const html = await render(
        PilotSitterApplicationConfirmationEmail({
          baseUrl,
          firstName: created.firstName,
          previewText: "Candidature reçue — DogShift",
        })
      );
      await sendEmail({
        to: created.email,
        subject: "Candidature reçue — DogShift",
        text,
        html,
      });
    } catch {
      // ignored
    }

    return NextResponse.json({ ok: true, id: created.id }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("constraint")) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    console.error("[api][sitter-applications][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
