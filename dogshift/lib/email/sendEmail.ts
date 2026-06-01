export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
};

/**
 * Optional second argument to `sendEmail()`. EVERY new call site should pass
 * `templateName` + `context` so the /admin/emails audit log is searchable.
 * Existing callers stay valid (it's optional) but they'll appear as
 * "(template inconnu)" in the admin UI — that's a soft signal to migrate them.
 */
export type SendEmailAudit = {
  /** Logical template id, e.g. "inactivity-warning-1", "reset-password" */
  templateName?: string;
  /** Where the email was triggered from, e.g. "cron:inactivity-check" */
  context?: string;
  /** DB id of the recipient when known (lets admin filter "all emails sent to user X"). */
  targetUserId?: string | null;
  /** Small PII-free extra context (IDs only). */
  metadata?: Record<string, unknown>;
};

export type SendEmailResult = {
  mode: "resend" | "smtp" | "log";
  /**
   * Provider-assigned message id. Populated for Resend; undefined for SMTP and log fallbacks.
   * Useful for logging / webhook responses / Sentry breadcrumbs.
   */
  messageId?: string;
};

function baseFromEnv() {
  const fromEnv = (process.env.EMAIL_FROM || "").trim();
  return fromEnv || "DogShift <no-reply@dogshift.ch>";
}

async function sendWithResend(input: SendEmailInput): Promise<SendEmailResult> {
  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  const fromEnv = (process.env.EMAIL_FROM || "").trim();
  const from = baseFromEnv();

  console.log("[email][resend] config", {
    hasResendKey: Boolean(resendKey),
    hasEmailFrom: Boolean(fromEnv),
  });

  if (!resendKey) {
    console.error("[email][resend] RESEND_API_KEY missing");
    throw new Error("RESEND_API_KEY_MISSING");
  }
  if (!fromEnv) {
    console.error("[email][resend] EMAIL_FROM missing");
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
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(input.headers ? { headers: input.headers } : {}),
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
    console.error("[email][resend] send failed", { status: res.status, details });
    throw new Error("EMAIL_SEND_FAILED");
  }

  let messageId: string | undefined;
  try {
    const body = (await res.json()) as { id?: unknown };
    if (typeof body?.id === "string" && body.id.length > 0) {
      messageId = body.id;
    }
  } catch {
    // Resend occasionally returns an empty body on success; we treat that as a soft success
    // because the 2xx status code is authoritative.
  }

  return { mode: "resend", messageId };
}

type NodemailerLike = {
  createTransport: (opts: unknown) => { sendMail: (mail: unknown) => Promise<unknown> };
};

async function sendWithSmtp(input: SendEmailInput): Promise<SendEmailResult> {
  // Lazy dynamic import so nodemailer is only loaded when SMTP is actually used,
  // avoiding bundling costs on serverless cold starts that only rely on Resend.
  // @ts-expect-error — @types/nodemailer is not installed; we narrow with NodemailerLike.
  const mod = (await import("nodemailer")) as { default?: NodemailerLike } & Partial<NodemailerLike>;
  const createTransport = mod.default?.createTransport ?? mod.createTransport;
  if (!createTransport) {
    throw new Error("NODEMAILER_IMPORT_FAILED");
  }

  const host = (process.env.SMTP_HOST || "").trim();
  const portRaw = (process.env.SMTP_PORT || "").trim();
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  if (!host || !portRaw || !user || !pass) throw new Error("SMTP_CONFIG_MISSING");

  const port = Number(portRaw);
  const secure = port === 465;
  const requireTLS = port === 587;

  const transporter = createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: { user, pass },
  });

  const from = (process.env.SMTP_FROM || "").trim() || user;

  const info = (await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })) as { messageId?: unknown };

  const messageId =
    typeof info?.messageId === "string" && info.messageId.length > 0 ? info.messageId : undefined;

  return { mode: "smtp", messageId };
}

export async function sendEmail(
  input: SendEmailInput,
  audit?: SendEmailAudit,
): Promise<SendEmailResult> {
  const resendKey = (process.env.RESEND_API_KEY || "").trim();

  let result: SendEmailResult | null = null;
  let caught: unknown = null;

  try {
    if (resendKey) {
      result = await sendWithResend(input);
    } else {
      try {
        result = await sendWithSmtp(input);
      } catch {
        const isProd = process.env.NODE_ENV === "production";
        if (isProd) {
          console.error("[email] no provider configured in production", {
            hasResendKey: Boolean((process.env.RESEND_API_KEY || "").trim()),
            hasSmtpHost: Boolean((process.env.SMTP_HOST || "").trim()),
          });
          throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
        }
        console.log("[email] no provider configured. Email payload:", {
          to: input.to,
          subject: input.subject,
          text: input.text,
        });
        result = { mode: "log" };
      }
    }
  } catch (err) {
    caught = err;
  }

  // Persist EVERY attempt (success + failure) into EmailLog. The write is
  // best-effort : if Prisma is unavailable we don't want to mask the original
  // outcome of the email send. Lazy-import keeps `sendEmail` usable in
  // contexts where Prisma isn't bundled (none today, but cheap insurance).
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.emailLog.create({
      data: {
        to: input.to,
        fromAddress: baseFromEnv(),
        subject: input.subject,
        templateName: audit?.templateName ?? null,
        context: audit?.context ?? null,
        targetUserId: audit?.targetUserId ?? null,
        status: caught ? "failed" : "sent",
        mode: result?.mode ?? null,
        messageId: result?.messageId ?? null,
        errorMessage: caught
          ? String(caught instanceof Error ? caught.message : caught).slice(0, 500)
          : null,
        metadata: audit?.metadata ? JSON.parse(JSON.stringify(audit.metadata)) : undefined,
      },
    });
  } catch (logErr) {
    console.error("[email] EmailLog write failed (non-fatal)", {
      to: input.to,
      subject: input.subject,
      err: logErr instanceof Error ? logErr.message : String(logErr),
    });
  }

  if (caught) throw caught;
  // result is guaranteed non-null on the success path.
  return result as SendEmailResult;
}
