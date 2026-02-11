import Image from "next/image";
import Link from "next/link";

import DogShiftBot from "@/components/DogShiftBot";
import PageTopOffset from "@/components/PageTopOffset";
import SiteHeader from "@/components/SiteHeader";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <PageTopOffset>{children}</PageTopOffset>
      <DogShiftBot />
      <footer className="border-t border-slate-200/70 bg-white">
        <div className="flex w-full flex-col gap-3 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-start sm:px-6">
          <div className="flex items-start gap-4">
            <Link href="/" aria-label="DogShift" className="inline-flex items-center">
              <Image
                src="/dogshift-logo.png"
                alt="DogShift"
                width={240}
                height={56}
                className="h-[52px] w-auto"
                priority={false}
              />
            </Link>
            <div className="flex flex-col items-start gap-1 pt-1">
              <Link
                href="/cgu"
                className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]"
              >
                CGU
              </Link>
              <Link
                href="/confidentialite"
                className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]"
              >
                Confidentialité
              </Link>
              <p className="font-medium text-slate-700">© {new Date().getFullYear()} DogShift</p>
              <a href="mailto:support@dogshift.ch" className="font-medium text-slate-700">
                Support : support@dogshift.ch
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
