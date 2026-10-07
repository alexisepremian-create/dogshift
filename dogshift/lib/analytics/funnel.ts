import { getConsentCookie } from "../cookieConsent";

export const FUNNEL_EVENTS = ["visit", "sitter_search", "sitter_view", "booking_start", "booking_submit", "payment_start", "payment_success", "funnel_error"] as const;
type FunnelEvent = typeof FUNNEL_EVENTS[number];
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "";
let initialized = false;
const seen = new Map<string, number>();
export function analyticsConfigured() { return /^G-[A-Z0-9]+$/.test(measurementId); }

export function enableFunnel() {
  if (typeof window === "undefined" || getConsentCookie() !== "all" || !analyticsConfigured()) return false;
  if (!initialized) {
    const w = window as AnalyticsWindow;
    w.dataLayer = w.dataLayer || [];
    w.gtag = w.gtag || function () {
      // eslint-disable-next-line prefer-rest-params -- Google documents an Arguments command queue
      w.dataLayer!.push(arguments);
    };
    w.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    w.gtag("js", new Date());
    // Never let automatic URL/title/referrer values reveal booking IDs or queries.
    w.gtag("set", { page_location: "https://dogshift.ch/", page_referrer: "", page_title: "DogShift" });
    w.gtag("config", measurementId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    initialized = true;
  }
  return true;
}

/** No arbitrary properties: IDs are used for local deduplication only, never sent. */
export function trackFunnel(event: FunnelEvent, dedupeKey?: string, errorStage?: "booking" | "payment") {
  if (!enableFunnel() || !FUNNEL_EVENTS.includes(event)) return;
  if (event !== "visit") trackFunnel("visit", "session");
  const key = dedupeKey ? `ds-funnel:${event}:${dedupeKey}` : null;
  if (key) {
    const now = Date.now();
    let last = seen.get(key) ?? 0;
    try { last = Math.max(last, Number(sessionStorage.getItem(key)) || 0); } catch { /* storage unavailable */ }
    if (now - last < 30 * 60 * 1000) return;
    seen.set(key, now);
    try { sessionStorage.setItem(key, String(now)); } catch { /* memory dedupe remains */ }
  }
  (window as AnalyticsWindow).gtag?.("event", event, {
    ...(event === "funnel_error" && errorStage ? { stage: errorStage } : {}),
    send_to: measurementId, page_location: `https://dogshift.ch/funnel/${event}`,
    page_referrer: "", page_title: "DogShift", transport_type: "beacon",
  });
}

export function clearFunnelStorage() {
  seen.clear();
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith("ds-funnel:")) sessionStorage.removeItem(key);
  } catch { /* optional storage */ }
}
