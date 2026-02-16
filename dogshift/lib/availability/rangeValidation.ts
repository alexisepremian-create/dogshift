export type TimeRange = { startMin: number; endMin: number };

export function clampMinute(v: unknown): number | null {
  const n = typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 0 || r > 24 * 60) return null;
  return r;
}

export function normalizeRanges(raw: unknown): { ok: true; ranges: TimeRange[] } | { ok: false; error: "INVALID_RANGES" } {
  if (!Array.isArray(raw)) return { ok: false, error: "INVALID_RANGES" };
  const out: TimeRange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return { ok: false, error: "INVALID_RANGES" };
    const startMin = clampMinute((item as any).startMin);
    const endMin = clampMinute((item as any).endMin);
    if (startMin === null || endMin === null) return { ok: false, error: "INVALID_RANGES" };
    if (endMin <= startMin) return { ok: false, error: "INVALID_RANGES" };
    out.push({ startMin, endMin });
  }
  out.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  for (let i = 1; i < out.length; i++) {
    if (out[i].startMin < out[i - 1].endMin) return { ok: false, error: "INVALID_RANGES" };
  }
  return { ok: true, ranges: out };
}
