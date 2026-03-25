type SendSmsResult =
  | { ok: true }
  | { ok: false; skipped?: boolean; error: string };

function normalizePhone(value: unknown) {
  let v = typeof value === "string" ? value.trim() : "";
  if (!v) return "";
  // normalize common formatting
  v = v.replaceAll(" ", "").replaceAll("-", "").replaceAll("(", "").replaceAll(")", "");
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  return v;
}

type TwilioEnv = { accountSid: string; authToken: string; from: string };
let twilioEnvCache: TwilioEnv | null | undefined = undefined;

function getTwilioEnv(): TwilioEnv | null {
  if (twilioEnvCache !== undefined) return twilioEnvCache;

  const accountSid = (process.env.TWILIO_ACCOUNT_SID ?? "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN ?? "").trim();
  const fromPhone = (process.env.TWILIO_PHONE_NUMBER ?? "").trim();
  const legacyFrom = (process.env.TWILIO_FROM ?? "").trim();

  if (!accountSid || !authToken) {
    console.info("[sms][twilio] skip: missing credentials", {
      hasAccountSid: Boolean(accountSid),
      hasAuthToken: Boolean(authToken),
    });
    twilioEnvCache = null;
    return null;
  }

  const from = fromPhone || legacyFrom;
  if (!fromPhone && legacyFrom) {
    console.info("[sms][twilio] using legacy env TWILIO_FROM (prefer TWILIO_PHONE_NUMBER)");
  }
  if (!from) {
    console.info("[sms][twilio] skip: missing TWILIO_PHONE_NUMBER");
    twilioEnvCache = null;
    return null;
  }

  twilioEnvCache = { accountSid, authToken, from };
  return twilioEnvCache;
}

export async function sendSms(params: { to: string; body: string }): Promise<SendSmsResult> {
  try {
    const to = normalizePhone(params.to);
    const body = typeof params.body === "string" ? params.body.trim() : "";

    if (!to || !body) {
      console.info("[sms] skip: missing to/body", { hasTo: Boolean(to), hasBody: Boolean(body) });
      return { ok: false, skipped: true, error: "MISSING_TO_OR_BODY" };
    }

    const env = getTwilioEnv();
    if (!env) return { ok: false, skipped: true, error: "TWILIO_NOT_CONFIGURED" };

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.accountSid)}/Messages.json`;
    const form = new URLSearchParams();
    form.set("To", to);
    form.set("From", normalizePhone(env.from));
    form.set("Body", body);

    const auth = Buffer.from(`${env.accountSid}:${env.authToken}`).toString("base64");

    const controller = new AbortController();
    const timeoutMs = 8000;
    const t = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(t);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[sms][twilio] send failed", { status: res.status, to });
      return { ok: false, error: `TWILIO_HTTP_${res.status}${text ? `:${text.slice(0, 240)}` : ""}` };
    }

    console.info("[sms][twilio] sent", { to });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    console.warn("[sms] crashed", { error: msg });
    return { ok: false, error: `SMS_CRASH:${msg}` };
  }
}

