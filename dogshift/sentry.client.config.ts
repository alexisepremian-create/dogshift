import * as Sentry from "@sentry/nextjs";

const PII_FIELDS = ["email", "name", "phone", "password", "passwordHash", "firstName", "lastName"];

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions in production for performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture replays only on errors (1% of sessions, 100% on error)
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],

  // Ignore common non-actionable browser errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    /^Load failed$/,
    /^Failed to fetch$/,
  ],

  // Strip PII fields from all events before sending to Sentry (RGPD compliance)
  beforeSend(event) {
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
