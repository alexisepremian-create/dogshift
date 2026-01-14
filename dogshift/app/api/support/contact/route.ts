import { NextResponse } from "next/server";

// Some environments ship nodemailer without TypeScript declarations.
// Use a require() import to avoid TS build failures while keeping runtime behavior.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require("nodemailer") as any;

export const runtime = "nodejs";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function isValidEmail(email: string) {
  // Simple validation (enough for a contact form).
  // Avoid over-strict rules that reject valid addresses.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendAutoReplyWithResend(input: { to: string }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return { ok: false as const, skipped: true as const, reason: "RESEND_API_KEY_MISSING" };

  // Resend Templates are addressed by template_id in the send API.
  // The published template name is: dogshift-auto-reply-support-copy
  // Keep the ID in env to avoid hardcoding and allow changes without redeploying.
  const templateId = (process.env.RESEND_SUPPORT_AUTOREPLY_TEMPLATE_ID || "").trim();
  if (!templateId) return { ok: false as const, skipped: true as const, reason: "TEMPLATE_ID_MISSING" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "support@dogshift.ch",
      to: input.to,
      // Keep subject here for compatibility even if the template includes one.
      subject: "DogShift — Nous avons bien reçu ta demande",
      // Published template name: dogshift-auto-reply-support-copy
      template_id: templateId,
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
    return { ok: false as const, skipped: false as const, status: res.status, details };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown; email?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!message) {
      return NextResponse.json({ ok: false, error: "MESSAGE_REQUIRED" }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ ok: false, error: "MESSAGE_TOO_LONG" }, { status: 400 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
    const userAgent = request.headers.get("user-agent") ?? "";

    const createdAt = new Date();
    const originPath = "/help";

    const smtpHost = requiredEnv("SMTP_HOST");
    const smtpPort = Number(requiredEnv("SMTP_PORT"));
    const smtpUser = requiredEnv("SMTP_USER");
    const smtpPass = requiredEnv("SMTP_PASS");

    const fromAddress = process.env.SMTP_FROM || smtpUser;
    const toAddress = "contact@dogshift.ch";

    const secure = smtpPort === 465;
    const requireTLS = smtpPort === 587;

    if (smtpUser !== "contact@dogshift.ch") {
      console.warn(
        `[support/contact] SMTP_USER is '${smtpUser}'. Expected 'contact@dogshift.ch'. Auth will usually fail if this is not the mailbox address.`
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      requireTLS,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const textBody =
      `${message}\n\n` +
      `---\n` +
      `Date et heure: ${createdAt.toISOString()}\n` +
      `Page d’origine: ${originPath}\n` +
      `x-forwarded-for: ${forwardedFor}\n` +
      `user-agent: ${userAgent}\n`;

    await transporter.sendMail({
      from: fromAddress,
      to: toAddress,
      subject: "[DogShift] Nouvelle demande – Centre d’aide",
      text: textBody,
      replyTo: fromAddress,
    });

    // Best-effort auto-reply to the user (must not block the internal email).
    if (email) {
      if (!isValidEmail(email)) {
        console.warn("[support/contact] invalid email for auto-reply", { email });
      } else {
        try {
          const autoReply = await sendAutoReplyWithResend({ to: email });

          if (!autoReply.ok) {
            console.warn("[support/contact] auto-reply failed", autoReply);
          }
        } catch (err) {
          console.warn("[support/contact] auto-reply threw", err);
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const e = err as {
      name?: string;
      message?: string;
      code?: string;
      command?: string;
      response?: string;
      responseCode?: number;
      errno?: unknown;
      syscall?: string;
      address?: string;
      port?: number;
      stack?: string;
    };

    console.error("[support/contact] send failed", {
      name: e?.name,
      message: e?.message,
      code: e?.code,
      command: e?.command,
      responseCode: e?.responseCode,
      response: e?.response,
      errno: e?.errno,
      syscall: e?.syscall,
      address: e?.address,
      port: e?.port,
      stack: e?.stack,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "SEND_FAILED",
        errorCode: e?.code || null,
        errorMessage: e?.message || "Unknown error",
        errorCommand: e?.command || null,
        errorResponseCode: typeof e?.responseCode === "number" ? e.responseCode : null,
      },
      { status: 500 }
    );
  }
}
