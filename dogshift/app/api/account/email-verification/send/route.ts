import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";
type HostProfileJson = {
  accountSettings?: unknown;
};

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
  const from = fromEnv || "DogShift no-reply@dogshift.ch";

  const subject = "Vérification de ton compte DogShift";
  const text = `Bonjour,\n\nClique sur ce lien pour vérifier ton email :\n${url}\n\nSi tu n’es pas à l’origine de cette demande, tu peux ignorer cet email.\n\n— DogShift\n`;

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji;">
    <div style="padding:28px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <div style="padding:22px 22px 0 22px;">
          <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;font-weight:700;">DogShift</div>
          <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.25;color:#0f172a;">Vérifie ton email</h1>
          <p style="margin:10px 0 0 0;font-size:14px;line-height:1.6;color:#334155;">
            Clique sur le bouton ci-dessous pour confirmer ton adresse email et sécuriser ton compte DogShift.
          </p>
        </div>

        <div style="padding:18px 22px 6px 22px;">
          <a href="${url}"
             style="display:inline-block;background:#0b0b0c;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:12px;">
            Vérifier mon email
          </a>
        </div>

        <div style="padding:0 22px 22px 22px;">
          <p style="margin:12px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">
            Si le bouton ne fonctionne pas, copie/colle ce lien dans ton navigateur :
          </p>
          <p style="margin:8px 0 0 0;font-size:13px;line-height:1.6;word-break:break-word;">
            <a href="${url}" style="color:#0f172a;text-decoration:underline;">${url}</a>
          </p>

          <div style="margin-top:18px;border-top:1px solid #e2e8f0;padding-top:14px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
              Si tu n’es pas à l’origine de cette demande, tu peux ignorer cet email.
            </p>
            <p style="margin:10px 0 0 0;font-size:12px;line-height:1.6;color:#64748b;">
              — DogShift
            </p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

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
        subject,
        text,
        html,
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
    const uid = await resolveDbUserId(req);
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
