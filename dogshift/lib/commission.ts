export const DOGSHIFT_COMMISSION_RATE = (() => {
  const raw = process.env.NEXT_PUBLIC_DOGSHIFT_COMMISSION_RATE;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0 && parsed < 1) return parsed;
  return 0.15;
})();
