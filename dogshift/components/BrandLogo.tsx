import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href: string;
  priority?: boolean;
};

export default function BrandLogo({ href, priority }: BrandLogoProps) {
  return (
    <Link href={href} aria-label="DogShift" className="inline-flex items-center gap-2 sm:gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm sm:h-11 sm:w-11">
        <Image
          src="/dogshift-logo.png"
          alt="DogShift"
          width={72}
          height={72}
          className="h-5 w-auto sm:h-8"
          priority={Boolean(priority)}
        />
      </span>
      <span className="text-[11px] font-semibold tracking-[0.22em] text-slate-600 sm:text-[13px]">DOGSHIFT</span>
    </Link>
  );
}
