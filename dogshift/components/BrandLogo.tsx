import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href: string;
  priority?: boolean;
};

export default function BrandLogo({ href, priority }: BrandLogoProps) {
  return (
    <Link href={href} aria-label="DogShift" className="inline-flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
        <Image
          src="/dogshift-logo.png"
          alt="DogShift"
          width={72}
          height={72}
          className="h-8 w-auto"
          priority={Boolean(priority)}
        />
      </span>
      <span className="text-[13px] font-semibold tracking-[0.22em] text-slate-600">DOGSHIFT</span>
    </Link>
  );
}
