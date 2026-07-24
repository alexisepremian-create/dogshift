"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile — the small "Vérifiez que vous êtes un humain" checkbox
 * (the embeddable widget, NOT the full-page Cloudflare interstitial).
 *
 * Env-gated: if NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set, this renders NOTHING
 * and forms treat the check as passed — so the site keeps working exactly as
 * before until the founder creates a Turnstile widget in the Cloudflare
 * dashboard and adds the two keys. Zero breakage without config.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** True when Turnstile is configured (site key present) — forms use this to require a token. */
export const TURNSTILE_ENABLED = Boolean(SITE_KEY);

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

export default function TurnstileWidget({
  onToken,
  className,
}: {
  /** Called with the token when solved, or null when it expires / errors. */
  onToken: (token: string | null) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || widgetIdRef.current || !containerRef.current) return;
      const ts = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (!ts) return;
      widgetIdRef.current = ts.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: "light",
        callback: (token: string) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": () => onTokenRef.current(null),
      });
    };

    // Load the Turnstile script once, then render.
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      renderWidget();
    }
    // The script may finish loading after this effect runs — poll briefly.
    const poll = setInterval(() => {
      if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) {
        renderWidget();
        if (widgetIdRef.current && poll) clearInterval(poll);
      }
    }, 200);
    setTimeout(() => poll && clearInterval(poll), 6000);

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      const ts = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (ts && widgetIdRef.current) {
        try {
          ts.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
      widgetIdRef.current = null;
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className={className} />;
}
