import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RoleJwt = { uid?: string; sub?: string };

type HostProfileJson = {
  accountSettings?: unknown;
};

function tokenUserId(token: RoleJwt | null) {
  const uid = typeof token?.uid === "string" ? token.uid : null;
  const sub = typeof token?.sub === "string" ? token.sub : null;
  return uid ?? sub;
}

function nowIso() {
  return new Date().toISOString();
}

function readLastSentAt(hostProfileJson: string | null) {
  if (!hostProfileJson) return null;
  try {
    const parsed = JSON.parse(hostProfileJson) as HostProfileJson;
    const sentAt = (parsed as any)?.accountSettings?.emailVerification?.lastSentAt;
    return typeof sentAt === "string" && sentAt.trim() ? sentAt.trim() : null;
  } catch {
    return null;
  }
}

function writeLastSentAt(hostProfileJson: string | null, iso: string) {
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
      ...((base as any)?.accountSettings && typeof (base as any).accountSettings === "object" ? (base as any).accountSettings : {}),
      emailVerification: {
        lastSentAt: iso,
      },
    },
  };

  return JSON.stringify(merged);
}

function hashToken(rawToken: string, secret: string) {
  return crypto.createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

function publicBaseUrlFromRequest(req: NextRequest) {
  const envUrl = (process.env.NEXTAUTH_URL || "").trim();
  if (envUrl) {
    try {
      const u = new URL(envUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      // fallthrough
    }
  }

  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
  const host =
    (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() ||
    (req.headers.get("host") || "").split(",")[0]?.trim() ||
    "";
  if (!host) return "";
  return `${proto}://${host}`;
}

function isLocalhostUrl(url: string) {
  const u = url.toLowerCase();
  return u.includes("localhost") || u.includes("127.0.0.1") || u.includes("0.0.0.0");
}

function emailVerificationTtlSeconds() {
  const raw = (process.env.EMAIL_VERIFICATION_TTL_SECONDS || "").trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return process.env.NODE_ENV === "production" ? 3600 : 86400;
}

async function sendEmail({ to, url }: { to: string; url: string }) {
  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  const fromEnv = (process.env.EMAIL_FROM || "").trim();
  const from = fromEnv || "DogShift <no-reply@dogshift.local>";

  if (resendKey) {
    if (!fromEnv) {
      console.error("[email-verification] EMAIL_FROM missing while RESEND_API_KEY is set");
      throw new Error("EMAIL_FROM_MISSING");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Vérifie ton email — DogShift",
        text: `Bonjour,\n\nClique sur ce lien pour vérifier ton email :\n${url}\n\nSi tu n’es pas à l’origine de cette demande, tu peux ignorer cet email.\n`,
        html: `<p>Bonjour,</p><p>Clique sur ce lien pour vérifier ton email :</p><p><a href="${url}">${url}</a></p><p>Si tu n’es pas à l’origine de cette demande, tu peux ignorer cet email.</p>`,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let details: unknown = null;
      try {
        details = text ? (JSON.parse(text) as unknown) : null;
      } catch {
        details = text;
      }
      console.error("[email-verification] resend failed", {
        status: res.status,
        details,
      });
      throw new Error("EMAIL_SEND_FAILED");
    }
    return { mode: "resend" as const };
  }

  console.log("[email-verification] RESEND_API_KEY missing. Verification link:", { to, url });
  return { mode: "log" as const };
}

export async function POST(req: NextRequest) {
  try {
    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as RoleJwt | null;
    const uid = tokenUserId(token);
    if (!uid) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, emailVerified: true, hostProfileJson: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ ok: false, error: "ALREADY_VERIFIED" }, { status: 409 });
    }

    const lastSentAtIso = readLastSentAt((user as any).hostProfileJson ?? null);
    if (lastSentAtIso) {
      const last = new Date(lastSentAtIso).getTime();
      if (Number.isFinite(last)) {
        const diff = Date.now() - last;
        const cooldownMs = 60_000;
        if (diff < cooldownMs) {
          const retryInSeconds = Math.max(1, Math.ceil((cooldownMs - diff) / 1000));
          return NextResponse.json({ ok: false, error: "COOLDOWN", retryInSeconds }, { status: 429 });
        }
      }
    }

    if (!process.env.NEXTAUTH_SECRET) {
      return NextResponse.json({ ok: false, error: "CONFIG_ERROR" }, { status: 500 });
    }

    const baseUrl = publicBaseUrlFromRequest(req);
    if (!baseUrl) {
      console.error("[email-verification] baseUrl missing", {
        uid,
        hasNextAuthUrl: Boolean(process.env.NEXTAUTH_URL),
      });
      return NextResponse.json({ ok: false, error: "CONFIG_ERROR" }, { status: 500 });
    }

    if (process.env.NODE_ENV === "production" && isLocalhostUrl(baseUrl)) {
      console.error("[email-verification] refusing localhost baseUrl in production", { baseUrl });
      return NextResponse.json({ ok: false, error: "CONFIG_ERROR" }, { status: 500 });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = hashToken(rawToken, process.env.NEXTAUTH_SECRET);

    const ttlSeconds = emailVerificationTtlSeconds();
    const expires = new Date(Date.now() + ttlSeconds * 1000);

    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token: hashed,
        expires,
      },
    });

    const url = `${baseUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(
      user.email
    )}`;

    try {
      await sendEmail({ to: user.email, url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "EMAIL_FROM_MISSING") {
        return NextResponse.json(
          {
            ok: false,
            error: "CONFIG_ERROR",
            message: "EMAIL_FROM is required when RESEND_API_KEY is set.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: false, error: "EMAIL_SEND_FAILED" }, { status: 502 });
    }

    const sentAt = nowIso();
    const hostProfileJson = writeLastSentAt((user as any).hostProfileJson ?? null, sentAt);
    await prisma.user.update({ where: { id: uid }, data: { hostProfileJson } });

    return NextResponse.json({ ok: true, sentAt }, { status: 200 });
  } catch (err) {
    console.error("[api][account][email-verification][send][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
