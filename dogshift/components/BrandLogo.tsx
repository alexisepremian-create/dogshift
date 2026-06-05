import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href: string;
  priority?: boolean;
};

/**
 * Two variants rendered side-by-side, swapped by CSS based on
 * `body[data-native="true"]`. The native variant uses the purple square +
 * white paw mark (matches the iOS / Android app icon and the onboarding
 * circles for full brand coherence). Web stays on the existing wordmark.
 */
export default function BrandLogo({ href, priority }: BrandLogoProps) {
  return (
    <Link href={href} aria-label="DogShift" className="inline-flex items-center gap-2 sm:gap-2.5">
      {/* Web variant — wordmark in a pill. Hidden in native via globals.css */}
      <span
        data-brand-logo-web=""
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"
      >
        <Image
          src="/dogshift-logo.png"
          alt="DogShift"
          width={72}
          height={72}
          className="h-9 w-auto"
          priority={Boolean(priority)}
        />
      </span>
      <span data-brand-logo-web-text="" className="text-[12px] font-bold tracking-[0.2em] text-slate-700">
        DOGSHIFT
      </span>

      {/* Native variant — the actual app icon (apple-touch-icon.png) clipped
          to a perfect circle. No DOGSHIFT wordmark below — the icon alone is
          enough (founder feedback : "faut faire un truc plus simple et propre
          sans bcp de texte juste ce qu'il faut"). Hidden on web via CSS. */}
      <span data-brand-logo-native="" className="hidden">
        <Image
          src="/apple-touch-icon.png"
          alt="DogShift"
          width={88}
          height={88}
          className="h-20 w-20 rounded-full object-cover shadow-[0_14px_32px_-12px_rgba(124,58,237,0.55)]"
          priority={Boolean(priority)}
        />
      </span>
    </Link>
  );
}
