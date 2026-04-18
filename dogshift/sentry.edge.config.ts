import * as Sentry from "@sentry/nextjs";

const sentryEnabled =
  process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLE_IN_DEV === "1";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: sentryEnabled,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  debug: false,
});
