/**
 * RunningDog — the shared "dog running" animation used by every in-app loading
 * surface (navigation overlay + Suspense PageLoader).
 *
 * It's a real run cycle: a 6-frame sprite strip (public/dog-run-strip.png — a
 * friendly retriever generated in Higgsfield, sliced + baseline-aligned) played
 * with a CSS `steps(6)` animation, so the dog's legs actually move (a gallop
 * gait) rather than just bobbing. Plus speed dashes streaming off the back and
 * a breathing contact shadow. Keyframes live in app/globals.css (prefixed
 * `rd-`). Transform/opacity only → 60 fps inside the iOS WKWebView.
 *
 * The strip is flat brand-purple raster art (matches the approved DA); the
 * `className` color still themes the speed dashes via currentColor.
 */

const FRAME_W = 684;
const FRAME_H = 436;

type Props = {
  /** Width in px (height follows the frame aspect ratio). Defaults to 168. */
  size?: number;
  className?: string;
};

export default function RunningDog({ size = 168, className }: Props) {
  const height = Math.round((size * FRAME_H) / FRAME_W);
  return (
    <span
      className={`rd-root${className ? ` ${className}` : ""}`}
      style={{ width: size, height }}
      aria-hidden="true"
    >
      {/* Speed dashes streaming off the back */}
      <span className="rd-dash rd-dash-1" />
      <span className="rd-dash rd-dash-2" />
      <span className="rd-dash rd-dash-3" />

      {/* 6-frame run cycle */}
      <span className="rd-sprite">
        <span className="rd-sprite-inner" />
      </span>

      {/* Contact shadow */}
      <span className="rd-shadow" />
    </span>
  );
}
