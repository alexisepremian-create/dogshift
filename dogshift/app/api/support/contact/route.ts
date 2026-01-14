import { NextResponse } from "next/server";

// Some environments ship nodemailer without TypeScript declarations.
// Use a require() import to avoid TS build failures while keeping runtime behavior.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require("nodemailer") as any;

export const runtime = "nodejs";

const AUTO_REPLY_TEXT = `Nous avons bien reçu votre message

Notre équipe vous répondra au plus vite avec une réponse personnalisée.

Bonjour,

Merci pour votre message et pour l’intérêt que vous portez à DogShift.

Ce qui se passe maintenant :
1. Nous analysons votre message
2. Nous revenons vers vous par email dès que possible
3. Si des informations manquent, nous vous recontacterons

Pour traiter votre demande plus vite, vous pouvez répondre à cet email en indiquant :
- Votre ville / région
- Le sujet (propriétaire / dog-sitter / réservation / autre)
- Toute information utile (dates, contraintes, etc.)

Découvrir DogShift :
https://dogshift.ch

DogShift · Suisse
support@dogshift.ch`;

const AUTO_REPLY_HTML = `
  
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;">
      <tbody><tr>
        <td align="center" style="padding:32px 16px;">

          
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">

            
            <tbody><tr>
              <td align="center" style="padding-bottom:20px;">
                <img src="https://dogshift.ch/dogshift-logo.png" alt="DogShift" width="120" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:auto;">
              </td>
            </tr>

            
            <tr>
              <td style="background:#ffffff;border-radius:16px;border:1px solid #e6ebf2;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                  
                  <tbody><tr>
                    <td style="padding:24px 24px 8px 24px;
                               font-family:Arial,Helvetica,sans-serif;
                               color:#111827;">
                      <h1 style="margin:0;font-size:20px;line-height:28px;">
                        Nous avons bien reçu votre message
                      </h1>
                      <p style="margin:6px 0 0 0;
                                font-size:14px;
                                line-height:22px;
                                color:#4b5563;">
                        Notre équipe vous répondra au plus vite avec une réponse personnalisée.
                      </p>
                    </td>
                  </tr>

                  
                  <tr>
                    <td style="padding:16px 24px;
                               font-family:Arial,Helvetica,sans-serif;
                               font-size:14px;
                               line-height:22px;
                               color:#111827;">
                      Bonjour,<br><br>
                      Merci pour votre message et pour l’intérêt que vous portez à
                      <strong>DogShift</strong>.
                    </td>
                  </tr>

                  
                  <tr>
                    <td style="padding:0 24px 16px 24px;">
                      <div style="background:#f8fafc;
                                  border:1px solid #e6ebf2;
                                  border-radius:12px;
                                  padding:16px;
                                  font-family:Arial,Helvetica,sans-serif;">
                        <strong style="display:block;margin-bottom:6px;">
                          Ce qui se passe maintenant
                        </strong>
                        <ol style="margin:0;padding-left:18px;
                                   font-size:13px;
                                   line-height:20px;
                                   color:#374151;">
                          <li>Nous analysons votre message</li>
                          <li>Nous revenons vers vous par email dès que possible</li>
                          <li>Si des informations manquent, nous vous recontacterons</li>
                        </ol>
                      </div>
                    </td>
                  </tr>

                  
                  <tr>
                    <td style="padding:0 24px 16px 24px;
                               font-family:Arial,Helvetica,sans-serif;
                               font-size:13px;
                               line-height:20px;
                               color:#374151;">
                      Pour traiter votre demande plus vite, vous pouvez répondre à cet email
                      en indiquant :
                      <ul style="margin:6px 0 0 0;padding-left:18px;">
                        <li>Votre ville / région</li>
                        <li>Le sujet (propriétaire / dog-sitter / réservation / autre)</li>
                        <li>Toute information utile (dates, contraintes, etc.)</li>
                      </ul>
                    </td>
                  </tr>

                  
                  <tr>
                    <td align="center" style="padding:8px 24px 20px 24px;">
                      <a href="https://dogshift.ch" style="background:#111827;
                                color:#ffffff;
                                text-decoration:none;
                                font-family:Arial,Helvetica,sans-serif;
                                font-size:14px;
                                padding:12px 20px;
                                border-radius:10px;
                                display:inline-block;">
                        Découvrir DogShift
                      </a>
                    </td>
                  </tr>

                </tbody></table>
              </td>
            </tr>

            
            <tr>
              <td align="center" style="padding:16px 8px 0 8px;
                         font-family:Arial,Helvetica,sans-serif;
                         font-size:12px;
                         line-height:18px;
                         color:#6b7280;">
                DogShift • Suisse<br>
                <a href="https://dogshift.ch" style="color:#6b7280;">dogshift.ch</a> ·
                <a href="mailto:support@dogshift.ch" style="color:#6b7280;">support@dogshift.ch</a>
              </td>
            </tr>

          </tbody></table>
        </td>
      </tr>
    </tbody></table>
  
`;

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
