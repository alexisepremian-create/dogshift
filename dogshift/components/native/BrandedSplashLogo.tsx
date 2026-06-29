/**
 * The DogShift splash logo (the real white paw + DOGSHIFT wordmark).
 *
 * The paw is the actual brand asset (`/public/dogshift-paw-white.png`), inlined
 * as a base64 data-URI in `.ds-splash-paw` (app/globals.css) — so it's the EXACT
 * brand mark AND paints with the (cached) CSS, with no separate network fetch /
 * 2732² decode that left a plain-purple gap on in-app reloads. Presentational
 * only (no hooks) → usable from the server layout AND client components.
 */
export default function BrandedSplashLogo() {
  return (
    <div className="flex flex-col items-center gap-[18px]">
      <div className="ds-splash-paw" aria-hidden="true" />
      <span className="text-[15px] font-bold tracking-[0.28em] text-white">DOGSHIFT</span>
    </div>
  );
}
