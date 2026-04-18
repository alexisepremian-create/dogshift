import * as Sentry from "@sentry/nextjs";

const PII_FIELDS = ["email", "name", "phone", "password", "passwordHash", "firstName", "lastName"];

const sentryEnabled =
  process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLE_IN_DEV === "1";

function isNextWebpackCacheNoise(message: string): boolean {
  if (!message.includes("ENOENT")) return false;
  if (!message.includes(".next")) return false;
  return message.includes("webpack") || message.includes("/cache/");
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: sentryEnabled,

  // Capture 10% of transactions in production for performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Strip PII fields from all server-side events before sending to Sentry (RGPD compliance)
  beforeSend(event) {
    const first = event.exception?.values?.[0];
    const msg = typeof first?.value === "string" ? first.value : "";
    if (msg && isNextWebpackCacheNoise(msg)) return null;
    function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (PII_FIELDS.includes(key)) {
          out[key] = "[Filtered]";
        } else if (val && typeof val === "object" && !Array.isArray(val)) {
          out[key] = scrubObject(val as Record<string, unknown>);
        } else {
          out[key] = val;
        }
      }
      return out;
    }
    if (event.request?.data && typeof event.request.data === "object") {
      event.request.data = scrubObject(event.request.data as Record<string, unknown>);
    }
    if (event.extra && typeof event.extra === "object") {
      event.extra = scrubObject(event.extra as Record<string, unknown>);
    }
    return event;
  },

  debug: false,
});
