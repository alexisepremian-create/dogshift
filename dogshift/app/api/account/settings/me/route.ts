import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";

import { prisma } from "@/lib/prisma";
import { zodParse } from "@/lib/validators/common";
import { accountSettingsPatchSchema } from "@/lib/validators/auth";

export const runtime = "nodejs";

function readLastEmailVerificationSentAt(hostProfileJson: string | null) {
  if (!hostProfileJson) return null;
  try {
    const parsed = JSON.parse(hostProfileJson) as any;
    const sentAt = parsed?.accountSettings?.emailVerification?.lastSentAt;
    return typeof sentAt === "string" && sentAt.trim() ? sentAt.trim() : null;
  } catch {
    return null;
  }
}

type SettingsState = {
  notifications: {
    newMessages: boolean;
    messageReceived: boolean;
    newBookingRequest: boolean;
    bookingConfirmed: boolean;
    paymentReceived: boolean;
    bookingReminder: boolean;
  };
  preferences: {
    language: "fr" | "en" | "it";
    timeZone: string;
    dateFormat: "auto" | "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy-mm-dd";
  };
};

function splitName(full: string) {
  const cleaned = (full ?? "").trim();
  if (!cleaned) return { firstName: "", lastName: "" };
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

function defaultSettings(): SettingsState {
  return {
    notifications: {
      newMessages: true,
      messageReceived: true,
      newBookingRequest: true,
      bookingConfirmed: true,
      paymentReceived: true,
      bookingReminder: true,
    },
    preferences: {
      language: "fr",
      timeZone: "",
      dateFormat: "auto",
    },
  };
}

function readSettingsFromHostProfileJson(hostProfileJson: string | null): SettingsState {
  const defaults = defaultSettings();
  if (!hostProfileJson) return defaults;
  try {
    const parsed = JSON.parse(hostProfileJson) as any;
    const settings = parsed?.accountSettings && typeof parsed.accountSettings === "object" ? parsed.accountSettings : null;

    const notifications = settings?.notifications && typeof settings.notifications === "object" ? settings.notifications : {};
    const preferences = settings?.preferences && typeof settings.preferences === "object" ? settings.preferences : {};

    return {
      notifications: {
        newMessages: typeof notifications.newMessages === "boolean" ? notifications.newMessages : defaults.notifications.newMessages,
        messageReceived:
          typeof notifications.messageReceived === "boolean" ? notifications.messageReceived : defaults.notifications.messageReceived,
        newBookingRequest:
          typeof notifications.newBookingRequest === "boolean"
            ? notifications.newBookingRequest
            : defaults.notifications.newBookingRequest,
        bookingConfirmed:
          typeof notifications.bookingConfirmed === "boolean" ? notifications.bookingConfirmed : defaults.notifications.bookingConfirmed,
        paymentReceived:
          typeof notifications.paymentReceived === "boolean" ? notifications.paymentReceived : defaults.notifications.paymentReceived,
        bookingReminder:
          typeof notifications.bookingReminder === "boolean" ? notifications.bookingReminder : defaults.notifications.bookingReminder,
      },
      preferences: {
        language:
          preferences.language === "fr" || preferences.language === "en" || preferences.language === "it"
            ? preferences.language
            : defaults.preferences.language,
        timeZone: typeof preferences.timeZone === "string" ? preferences.timeZone : defaults.preferences.timeZone,
        dateFormat:
          preferences.dateFormat === "auto" || preferences.dateFormat === "dd/mm/yyyy" || preferences.dateFormat === "mm/dd/yyyy" || preferences.dateFormat === "yyyy-mm-dd"
            ? preferences.dateFormat
            : defaults.preferences.dateFormat,
      },
    };
  } catch {
    return defaults;
  }
}

function mergeSettingsIntoHostProfileJson(hostProfileJson: string | null, next: SettingsState) {
  let base: any = {};
  if (hostProfileJson) {
    try {
      base = JSON.parse(hostProfileJson) as any;
    } catch {
      base = {};
    }
  }

  const merged = {
    ...(base && typeof base === "object" ? base : {}),
    accountSettings: {
      notifications: next.notifications,
      preferences: next.preferences,
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  };

  return JSON.stringify(merged);
}

export async function GET(req: NextRequest) {
  try {
    const __authed = await getAuthedDbUser();
    const userId = __authed?.id ?? null;
    if (!__authed) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // (() => null) /* currentUser removed */() removed — use __authed.email / __authed.name
    const primaryEmail = __authed?.email ?? "";
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ensured = (__authed ? { id: __authed.id, role: __authed.role, sitterId: __authed.sitterId, created: false } : null);
    if (!ensured) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: __authed.id } });
    if (!dbUser) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: dbUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emailVerified: true,
        passwordHash: true,
        role: true,
        hostProfileJson: true,
        accounts: { select: { provider: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const name = typeof user.name === "string" ? user.name : "";
    const { firstName, lastName } = splitName(name);

    // googleConnected / emailVerified now come from Auth.js Account + User rows.
    const googleAccount = await prisma.account.findFirst({
      where: { userId: user.id, provider: "google" },
      select: { id: true },
    });
    const googleConnected = Boolean(googleAccount);

    const lastVerificationEmailSentAt = readLastEmailVerificationSentAt((user as any).hostProfileJson ?? null);
    const emailVerified = Boolean((user as any).emailVerified);

    const emailVerificationStatus = (() => {
      if (emailVerified) return "verified" as const;
      if (!lastVerificationEmailSentAt) return "unverified" as const;
      const ts = new Date(lastVerificationEmailSentAt).getTime();
      if (!Number.isFinite(ts)) return "unverified" as const;
      const pendingWindowMs = 10 * 60 * 1000;
      return Date.now() - ts < pendingWindowMs ? ("pending" as const) : ("unverified" as const);
    })();

    const settings = readSettingsFromHostProfileJson((user as any).hostProfileJson ?? null);

    return NextResponse.json(
      {
        ok: true,
        profile: {
          firstName,
          lastName,
          email: String((user as any).email ?? ""),
          phone: typeof (user as any).phone === "string" ? String((user as any).phone) : null,
        },
        security: {
          googleConnected,
          emailVerified,
          passwordSet: Boolean((user as any).passwordHash),
        },
        emailVerificationStatus,
        lastVerificationEmailSentAt,
        provider: googleConnected ? "google" : "credentials",
        settings,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][account][settings][me][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

type PatchBody = {
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  notifications?: unknown;
  preferences?: unknown;
};

export async function PATCH(req: NextRequest) {
  try {
    const __authed = await getAuthedDbUser();
    const userId = __authed?.id ?? null;
    if (!__authed) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // (() => null) /* currentUser removed */() removed — use __authed.email / __authed.name
    const primaryEmail = __authed?.email ?? "";
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ensured = (__authed ? { id: __authed.id, role: __authed.role, sitterId: __authed.sitterId, created: false } : null);
    if (!ensured) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: __authed.id } });
    if (!dbUser) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const parsedBody = zodParse(accountSettingsPatchSchema, rawBody);
    if (!parsedBody.ok) return parsedBody.response;

    const body = parsedBody.data as PatchBody;

    const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
    const phoneRaw = typeof body?.phone === "string" ? body.phone.trim() : undefined;
    const phone = phoneRaw !== undefined ? (phoneRaw ? phoneRaw : null) : undefined;

    const user = await prisma.user.findUnique({ where: { id: dbUser.id }, select: { id: true, hostProfileJson: true } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const currentSettings = readSettingsFromHostProfileJson((user as any).hostProfileJson ?? null);

    const nextSettings: SettingsState = {
      notifications: {
        ...currentSettings.notifications,
        ...(body?.notifications && typeof body.notifications === "object" ? (body.notifications as any) : null),
      },
      preferences: {
        ...currentSettings.preferences,
        ...(body?.preferences && typeof body.preferences === "object" ? (body.preferences as any) : null),
      },
    };

    if (!(nextSettings.preferences.language === "fr" || nextSettings.preferences.language === "en" || nextSettings.preferences.language === "it")) {
      nextSettings.preferences.language = currentSettings.preferences.language;
    }

    if (
      !(
        nextSettings.preferences.dateFormat === "auto" ||
        nextSettings.preferences.dateFormat === "dd/mm/yyyy" ||
        nextSettings.preferences.dateFormat === "mm/dd/yyyy" ||
        nextSettings.preferences.dateFormat === "yyyy-mm-dd"
      )
    ) {
      nextSettings.preferences.dateFormat = currentSettings.preferences.dateFormat;
    }

    if (typeof nextSettings.preferences.timeZone !== "string") {
      nextSettings.preferences.timeZone = currentSettings.preferences.timeZone;
    }

    const hostProfileJson = mergeSettingsIntoHostProfileJson((user as any).hostProfileJson ?? null, nextSettings);

    const name = [firstName, lastName].filter(Boolean).join(" ").trim();

    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        ...(name ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        hostProfileJson,
      },
      select: { id: true },
    });

    // If phone is removed, automatically disable global last-minute bookings for sitters.
    if (phone === null) {
      await prisma.sitterProfile.updateMany({
        where: { userId: dbUser.id, lastMinuteEnabled: true },
        data: { lastMinuteEnabled: false },
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api][account][settings][me][PATCH] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
