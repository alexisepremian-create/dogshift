/**
 * The DogShift splash logo (the real white paw + DOGSHIFT wordmark).
 *
 * It's the actual brand asset (`/public/dogshift-paw-white.png`, which already
 * includes the DOGSHIFT wordmark), inlined as a base64 data-URI in
 * `.ds-splash-paw` (app/globals.css) — so it's the EXACT brand mark AND paints
 * with the (cached) CSS, with no separate fetch / 2732² decode that left a
 * plain-purple gap on in-app reloads. Presentational only (no hooks) → usable
 * from the server layout AND client components.
 */
export default function BrandedSplashLogo() {
  return <div className="ds-splash-paw" aria-hidden="true" />;
}
