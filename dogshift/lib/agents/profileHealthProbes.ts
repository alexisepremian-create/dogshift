/**
 * Synthetic HTTP probes — V1 scope: public routes only.
 *
 * Each probe is a single GET against the public web (no auth cookies) that
 * asserts a specific 2xx response and an optional body-contains check. They
 * exist to catch the class of bug where the data is fine but the rendering
 * is broken — e.g. a refactor removes a critical component from the layout
 * and the sitter profile page silently returns an empty body.
 *
 * V2 will add probes against protected routes via a dedicated signed cookie;
 * for now we cover homepage, /sitters, /login, /signup, and every published
 * /sitters/[id]. Bounded at MAX_SITTER_PROBES = 50 so the total run stays
 * under ~30s even if Vercel's serverless cold-start is slow.
 */

export const MAX_SITTER_PROBES = 50;

export type ProbeResult = {
  name: string;
  url: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  error?: string;
};

export async function runProbe(args: {
  name: string;
  url: string;
  expectStatus?: number;
  expectContains?: string;
  timeoutMs?: number;
}): Promise<ProbeResult> {
  const { name, url } = args;
  const expectStatus = args.expectStatus ?? 200;
  const timeoutMs = args.timeoutMs ?? 10000;
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "user-agent": "DogShift-ProfileHealth/1.0" },
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.status !== expectStatus) {
      return {
        name,
        url,
        ok: false,
        status: res.status,
        durationMs: Date.now() - started,
        error: `expected ${expectStatus}, got ${res.status}`,
      };
    }

    if (args.expectContains) {
      // Read up to 256 KB to avoid pulling huge homepage HTML into RAM.
      const text = await res.text();
      const slice = text.slice(0, 256 * 1024);
      if (!slice.includes(args.expectContains)) {
        return {
          name,
          url,
          ok: false,
          status: res.status,
          durationMs: Date.now() - started,
          error: `body does not contain "${args.expectContains}"`,
        };
      }
    }

    return {
      name,
      url,
      ok: true,
      status: res.status,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    return {
      name,
      url,
      ok: false,
      status: null,
      durationMs: Date.now() - started,
      error: message,
    };
  }
}

export function buildPublicProbes(baseUrl: string): Array<{
  name: string;
  url: string;
  expectStatus?: number;
  expectContains?: string;
}> {
  // Note (audit 2026-06-08): `/login` and `/signup` are gated by Cloudflare's
  // Managed Challenge to deter credential-stuffing. The challenge inspects the
  // User-Agent and returns 403 to anything that doesn't look like a real
  // browser — including our `DogShift-ProfileHealth/1.0` probe. We removed
  // them from the public probes because they generated a persistent
  // false-positive 🔴 every night despite the pages working fine for real
  // users. The real coverage for auth lives in
  // `/api/cron/auth-health-check` (it exercises sign-in end-to-end with a
  // real session cookie, which bypasses the challenge).
  //
  // The homepage and /devenir-dogsitter remain probed because they're
  // permissive (no Cloudflare challenge) and a 4xx/5xx there means the site
  // is actually down for everyone.
  return [
    { name: "homepage", url: `${baseUrl}/`, expectStatus: 200 },
    { name: "sitters-list", url: `${baseUrl}/sitters`, expectStatus: 200 },
    { name: "become-sitter", url: `${baseUrl}/devenir-dogsitter`, expectStatus: 200 },
  ];
}

export function buildSitterProfileProbes(
  baseUrl: string,
  sitterIds: string[],
): Array<{ name: string; url: string; expectStatus?: number }> {
  return sitterIds.slice(0, MAX_SITTER_PROBES).map((sid) => ({
    name: `sitter-${sid}`,
    url: `${baseUrl}/sitters/${sid}`,
    expectStatus: 200,
  }));
}
