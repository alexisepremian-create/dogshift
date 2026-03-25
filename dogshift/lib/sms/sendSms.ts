import { Vonage } from "@vonage/server-sdk";
import { SMSFailure } from "@vonage/sms";

/**
 * Transactional SMS only (server-side). Uses Vonage SMS API.
 *
 * Sender: set `VONAGE_SMS_FROM` to an alphanumeric label (≤11 chars, e.g. "DogShift")
 * or to a Vonage/long number in E.164 if your destination network rejects alphanumeric IDs.
 */
type SendSmsResult =
  | { ok: true }
  | { ok: false; skipped?: boolean; error: string };

const DEFAULT_ALPHANUMERIC_FROM = "DogShift";

function normalizePhone(value: unknown) {
  let v = typeof value === "string" ? value.trim() : "";
  if (!v) return "";
  v = v.replaceAll(" ", "").replaceAll("-", "").replaceAll("(", "").replaceAll(")", "");
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  return v;
}

/** True if value looks like a phone number (digits, optional leading +). */
function looksLikePhone(value: string) {
  return /^\+?[0-9]{6,20}$/.test(value.replaceAll(/\s/g, ""));
}

/** `VONAGE_SMS_FROM`: alphanum sender (letters/digits, ≤11 chars after trim) or long-code phone in E.164 (e.g. +41791234567); unset → "DogShift". */
function resolveSmsFrom(): string {
  const raw = (process.env.VONAGE_SMS_FROM ?? "").trim();
  if (!raw) return DEFAULT_ALPHANUMERIC_FROM;
  if (looksLikePhone(raw)) return normalizePhone(raw) || raw;
  return raw.length > 11 ? raw.slice(0, 11) : raw;
}

type VonageSmsContext = { client: Vonage; from: string };
let vonageContextCache: VonageSmsContext | null | undefined = undefined;

function getVonageSmsContext(): VonageSmsContext | null {
  if (vonageContextCache !== undefined) return vonageContextCache;

  const apiKey = (process.env.VONAGE_API_KEY ?? "").trim();
  const apiSecret = (process.env.VONAGE_API_SECRET ?? "").trim();

  if (!apiKey || !apiSecret) {
    console.info("[sms][vonage] skip: missing credentials", {
      hasApiKey: Boolean(apiKey),
      hasApiSecret: Boolean(apiSecret),
    });
    vonageContextCache = null;
    return null;
  }

  const from = resolveSmsFrom();
  vonageContextCache = {
    client: new Vonage({ apiKey, apiSecret }),
    from,
  };
  return vonageContextCache;
}

function vonageErrorDetail(err: SMSFailure): string {
  try {
    const failed = err.getFailedMessages();
    const parts = failed.map((m) => {
      const any = m as Record<string, unknown>;
      const text =
        typeof any.errorText === "string"
          ? any.errorText
          : typeof any["error-text"] === "string"
            ? (any["error-text"] as string)
            : "";
      const status = typeof any.status === "string" ? any.status : "";
      return [status, text].filter(Boolean).join(":");
    });
    const joined = parts.filter(Boolean).join("; ");
    return joined || err.message;
  } catch {
    return err.message;
  }
}

export async function sendSms(params: { to: string; body: string }): Promise<SendSmsResult> {
  try {
    const to = normalizePhone(params.to);
    const body = typeof params.body === "string" ? params.body.trim() : "";

    if (!to || !body) {
      console.info("[sms] skip: missing to/body", { hasTo: Boolean(to), hasBody: Boolean(body) });
      return { ok: false, skipped: true, error: "MISSING_TO_OR_BODY" };
    }

    const ctx = getVonageSmsContext();
    if (!ctx) {
      return { ok: false, skipped: true, error: "VONAGE_NOT_CONFIGURED" };
    }

    try {
      await ctx.client.sms.send({
        to,
        from: ctx.from,
        text: body,
      });
    } catch (err) {
      if (err instanceof SMSFailure) {
        const detail = vonageErrorDetail(err).slice(0, 240);
        console.warn("[sms][vonage] send failed", { to, detail });
        return { ok: false, error: `VONAGE_SMS_FAILED:${detail}` };
      }
      throw err;
    }

    console.info("[sms][vonage] sent", { to });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    console.warn("[sms] crashed", { error: msg });
    return { ok: false, error: `SMS_CRASH:${msg}` };
  }
}

export type { SendSmsResult };
