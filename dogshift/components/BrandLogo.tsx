import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href: string;
  priority?: boolean;
};

export default function BrandLogo({ href, priority }: BrandLogoProps) {
  return (
    <Link href={href} aria-label="DogShift" className="inline-flex items-center gap-2 sm:gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
        <Image
          src="/dogshift-logo.png"
          alt="DogShift"
          width={72}
          height={72}
          className="h-9 w-auto"
          priority={Boolean(priority)}
        />
      </span>
      <span className="text-[12px] font-bold tracking-[0.2em] text-slate-700">DOGSHIFT</span>
    </Link>
  );
}
