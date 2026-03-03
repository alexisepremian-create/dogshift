import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { render } from "@react-email/render";

import {
  PilotSitterApplicationConfirmationEmail,
  pilotSitterApplicationConfirmationCtaUrl,
  pilotSitterApplicationConfirmationPlainText,
} from "@/lib/email/templates/pilotSitterApplicationConfirmation";

export const runtime = "nodejs";

function baseUrlFromRequest(req: NextRequest) {
  const appUrl = (process.env.APP_URL || "").trim();
  if (appUrl) return appUrl.replace(/\/$/, "");

  const publicAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (publicAppUrl) return publicAppUrl.replace(/\/$/, "");

  const env = (process.env.NEXTAUTH_URL || "").trim();
  if (env) return env.replace(/\/$/, "");

  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
  const host =
    (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() ||
    (req.headers.get("host") || "").split(",")[0]?.trim() ||
    "";
  if (!host) return "";
  return `${proto}://${host}`;
}

function isValidEmail(value: string) {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidPhone(value: string) {
  const v = value.replace(/\s+/g, " ").trim();
  if (!v) return false;
  return /^[+()\d][\d()\s-]{6,}$/.test(v);
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;

    // basic spam honeypot
    const company = normalizeString(payload.company, 120);
    if (company) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

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

    const utmSource = normalizeNullableString(payload.utmSource, 120);
    const utmMedium = normalizeNullableString(payload.utmMedium, 120);
    const utmCampaign = normalizeNullableString(payload.utmCampaign, 120);
    const utmContent = normalizeNullableString(payload.utmContent, 120);
    const utmTerm = normalizeNullableString(payload.utmTerm, 120);

    const referrer = normalizeNullableString(payload.referrer, 500);

    if (!firstName || !lastName || !city || !email || !phone) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS", message: "Merci de remplir tous les champs requis." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "INVALID_EMAIL", message: "Email invalide." }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ ok: false, error: "INVALID_PHONE", message: "Téléphone invalide." }, { status: 400 });
    }
    if (!experienceText || !motivationText || !availabilityText) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS", message: "Merci de compléter les champs de texte." }, { status: 400 });
    }
    if (!consentInterview || !consentPrivacy) {
      return NextResponse.json({ ok: false, error: "CONSENT_REQUIRED", message: "Merci d’accepter les consentements." }, { status: 400 });
    }

    const idempotencyKey = (req.headers.get("x-idempotency-key") ?? "").trim() || null;

    const ip = readIp(req);
    const userAgent = normalizeNullableString(req.headers.get("user-agent"), 500);

    const db = prisma as unknown as {
      pilotSitterApplication: {
        create: (args: unknown) => Promise<{ id: string; email: string; firstName: string }>;
      };
    };

    const created = await db.pilotSitterApplication.create({
      data: {
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

    // best-effort confirmation email
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
      // ignore (do not block application creation)
    }

    return NextResponse.json({ ok: true, id: created.id }, { status: 200 });
  } catch (err: unknown) {
    // Handle idempotency unique constraint (email + idempotencyKey)
    const msg = err instanceof Error ? err.message : "";
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("constraint")) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    console.error("[api][sitter-applications][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
