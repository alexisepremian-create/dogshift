/**
 * The DogShift splash logo (white paw + DOGSHIFT wordmark) as INLINE SVG.
 *
 * Inline SVG is the whole point: it paints with the document, with zero image
 * fetch/decode. The PNG splash (`/native-splash.png`, 2732²) has a decode gap on
 * every in-app hard-nav reload — long enough to show a plain-purple screen with
 * no logo during logout/login (the native LaunchScreen only hides this on cold
 * launch, not on reloads). This vector renders instantly, so the logo is present
 * the entire time. Presentational only (no hooks) → usable from the server
 * layout AND client components.
 */
export default function BrandedSplashLogo() {
  return (
    <div className="flex flex-col items-center gap-[18px]">
      <svg width="92" height="92" viewBox="0 0 120 120" fill="#ffffff" aria-hidden="true">
        <ellipse cx="28" cy="52" rx="10" ry="14" transform="rotate(-25 28 52)" />
        <ellipse cx="49" cy="40" rx="11" ry="15" transform="rotate(-8 49 40)" />
        <ellipse cx="71" cy="40" rx="11" ry="15" transform="rotate(8 71 40)" />
        <ellipse cx="92" cy="52" rx="10" ry="14" transform="rotate(25 92 52)" />
        <path d="M60 62 C 44 62, 33 73, 33 84 C 33 96, 45 102, 60 102 C 75 102, 87 96, 87 84 C 87 73, 76 62, 60 62 Z" />
      </svg>
      <span className="text-[15px] font-bold tracking-[0.28em] text-white">DOGSHIFT</span>
    </div>
  );
}
