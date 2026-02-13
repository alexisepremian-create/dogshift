export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function baseFromEnv() {
  const fromEnv = (process.env.EMAIL_FROM || "").trim();
  return fromEnv || "DogShift <no-reply@dogshift.ch>";
}

async function sendWithResend(input: SendEmailInput) {
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

  return { mode: "resend" as const };
}

async function sendWithSmtp(input: SendEmailInput) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodemailer = require("nodemailer") as any;

  const host = (process.env.SMTP_HOST || "").trim();
  const portRaw = (process.env.SMTP_PORT || "").trim();
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  if (!host || !portRaw || !user || !pass) throw new Error("SMTP_CONFIG_MISSING");

  const port = Number(portRaw);
  const secure = port === 465;
  const requireTLS = port === 587;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: { user, pass },
  });

  const from = (process.env.SMTP_FROM || "").trim() || user;

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return { mode: "smtp" as const };
}

export async function sendEmail(input: SendEmailInput) {
  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  if (resendKey) return sendWithResend(input);

  try {
    return await sendWithSmtp(input);
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
    return { mode: "log" as const };
  }
}
