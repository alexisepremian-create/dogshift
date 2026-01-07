import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href: string;
  priority?: boolean;
};

export default function BrandLogo({ href, priority }: BrandLogoProps) {
  return (
    <Link href={href} aria-label="DogShift" className="inline-flex items-center">
      <Image
        src="/dogshift-logo.png"
        alt="DogShift"
        width={240}
        height={56}
        className="h-[104px] w-auto"
        priority={Boolean(priority)}
      />
    </Link>
  );
}
