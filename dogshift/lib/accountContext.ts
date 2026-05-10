type AccountContextData = {
  ok?: boolean;
  monEspaceHref?: string;
  hasSitterProfile?: boolean;
};

let _inflight: Promise<AccountContextData> | null = null;
let _cached: { ts: number; data: AccountContextData } | null = null;
const TTL = 30_000;

/**
 * Fetch /api/account/context with in-memory dedup.
 * Multiple callers within the same page load share one request.
 */
export async function fetchAccountContext(): Promise<AccountContextData> {
  if (_cached && Date.now() - _cached.ts < TTL) return _cached.data;
  if (_inflight) return _inflight;

  _inflight = fetch("/api/account/context", { method: "GET", cache: "no-store" })
    .then(async (res) => {
      const data = (await res.json().catch(() => ({}))) as AccountContextData;
      _cached = { ts: Date.now(), data };
      return data;
    })
    .finally(() => { _inflight = null; });

  return _inflight;
}
