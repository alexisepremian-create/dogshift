import { Vonage } from "@vonage/server-sdk";
import { SMSFailure, TypeEnum } from "@vonage/sms";

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

/**
 * NFC + replace typographic punctuation with ASCII so GSM/Latin paths behave;
 * full UTF-8 accent preservation relies on {@link TypeEnum.UNICODE} below.
 */
function normalizeVonageSmsText(raw: string): string {
  let s = raw.normalize("NFC");
  s = s.replace(/\u2018|\u2019|\u2032/gu, "'"); // ‘ ’ ′ → '
  s = s.replace(/\u201C|\u201D|\u201E/gu, '"'); // “ ” „ → "
  s = s.replace(/\u00A0|\u202F/gu, " "); // NBSP, narrow NBSP
  s = s.replace(/\u2026/gu, "..."); // …
  s = s.replace(/\u2013|\u2014/gu, "-"); // – —
  return s;
}

/** True if any codepoint outside 7-bit ASCII (needs Vonage `unicode` type for correct delivery). */
function smsNeedsUnicodeType(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp > 0x7f) return true;
  }
  return false;
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
    const bodyRaw = typeof params.body === "string" ? params.body.trim() : "";
    const body = normalizeVonageSmsText(bodyRaw);

    if (!to || !body) {
      console.info("[sms] skip: missing to/body", { hasTo: Boolean(to), hasBody: Boolean(body) });
      return { ok: false, skipped: true, error: "MISSING_TO_OR_BODY" };
    }

    const ctx = getVonageSmsContext();
    if (!ctx) {
      return { ok: false, skipped: true, error: "VONAGE_NOT_CONFIGURED" };
    }

    try {
      const useUnicode = smsNeedsUnicodeType(body);
      await ctx.client.sms.send({
        to,
        from: ctx.from,
        text: body,
        ...(useUnicode ? { type: TypeEnum.UNICODE } : {}),
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
