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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";

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
