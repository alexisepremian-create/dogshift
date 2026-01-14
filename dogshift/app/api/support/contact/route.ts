import { NextResponse } from "next/server";

// Some environments ship nodemailer without TypeScript declarations.
// Use a require() import to avoid TS build failures while keeping runtime behavior.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require("nodemailer") as any;

export const runtime = "nodejs";

const AUTO_REPLY_TEXT = "Nous avons bien reçu votre message. Notre équipe support vous répondra dans les plus brefs délais. — DogShift";

const AUTO_REPLY_HTML = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DogShift — Support</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="padding:28px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <div style="padding:22px 22px 0 22px;">
          <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;font-weight:700;">DogShift</div>
          <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.25;color:#0f172a;">Nous avons bien reçu votre message</h1>
          <p style="margin:10px 0 0 0;font-size:14px;line-height:1.6;color:#334155;">
            Merci de nous avoir contactés. Notre équipe support vous répondra dans les plus brefs délais.
          </p>
        </div>
        <div style="padding:18px 22px 22px 22px;">
          <div style="margin-top:18px;border-top:1px solid #e2e8f0;padding-top:14px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
              Vous pouvez aussi nous écrire à <a href="mailto:support@dogshift.ch" style="color:#0f172a;text-decoration:underline;">support@dogshift.ch</a>.
            </p>
            <p style="margin:10px 0 0 0;font-size:12px;line-height:1.6;color:#64748b;">— DogShift</p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

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

function maskEmail(email: string) {
  const at = email.indexOf("@");
  if (at <= 1) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const maskedLocal = `${local[0]}***${local[local.length - 1] ?? ""}`;
  return `${maskedLocal}@${domain}`;
}

async function sendAutoReplyWithResend(input: { to: string }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return { ok: false as const, skipped: true as const, reason: "RESEND_API_KEY_MISSING" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "DogShift Support <support@dogshift.ch>",
      to: input.to,
      reply_to: "support@dogshift.ch",
      subject: "Nous avons bien reçu votre message — DogShift",
      html: AUTO_REPLY_HTML,
      text: AUTO_REPLY_TEXT,
    }),
  });

  const rawText = await res.text().catch(() => "");

  if (!res.ok) {
    let details: unknown = null;
    try {
      details = rawText ? (JSON.parse(rawText) as unknown) : null;
    } catch {
      details = rawText;
    }
    return { ok: false as const, skipped: false as const, status: res.status, details };
  }

  let data: unknown = null;
  try {
    data = rawText ? (JSON.parse(rawText) as unknown) : null;
  } catch {
    data = rawText;
  }

  const id = typeof (data as any)?.id === "string" ? (data as any).id : null;
  return { ok: true as const, id };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown; email?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const emailValid = Boolean(email) && isValidEmail(email);

    console.info("[support/contact] request", {
      messageLength: message.length,
      hasEmail: Boolean(email),
      emailMasked: email ? maskEmail(email) : null,
      emailValid,
      hasResendKey: Boolean((process.env.RESEND_API_KEY || "").trim()),
    });

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
    const toAddress = "support@dogshift.ch";

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

    console.info("[support/contact] smtp sending", {
      toAddress,
      fromAddress,
      replyTo: emailValid ? maskEmail(email) : fromAddress,
    });

    await transporter.sendMail({
      from: fromAddress,
      to: toAddress,
      subject: "[DogShift] Nouvelle demande – Centre d’aide",
      text: textBody,
      replyTo: emailValid ? email : fromAddress,
    });

    console.info("[support/contact] smtp sent", { toAddress });

    // Best-effort auto-reply to the user (must not block the internal email).
    let autoReply: "skipped" | "sent" | "failed" = "skipped";

    if (email) {
      if (!emailValid) {
        console.info("[support/contact] auto-reply skipped (invalid email)", { emailMasked: maskEmail(email) });
      } else {
        console.info("[support/contact] auto-reply attempting", { emailMasked: maskEmail(email) });
        try {
          const res = await sendAutoReplyWithResend({ to: email });
          if (res.ok) {
            autoReply = "sent";
            console.info("[support/contact] autoresponder ok", { emailMasked: maskEmail(email), id: (res as any).id ?? null });
          } else {
            autoReply = "failed";
            console.error("[support/contact] auto-reply failed", res);
          }
        } catch (err) {
          autoReply = "failed";
          console.error("[support/contact] auto-reply threw", err);
        }
      }
    }

    return NextResponse.json({ ok: true, autoReply }, { status: 200 });
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
