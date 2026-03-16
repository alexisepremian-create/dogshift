import Link from "next/link";
import Image from "next/image";

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
        <div className="w-full px-4 py-8 text-sm text-slate-600 sm:px-6">
          <div className="flex flex-col gap-6 sm:gap-8">
            <div className="flex items-start gap-4">
              <Link href="/" aria-label="DogShift" className="inline-flex items-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                  <Image src="/dogshift-logo.png" alt="DogShift" width={72} height={72} className="h-8 w-auto" />
                </span>
              </Link>
              <div className="grid flex-1 grid-cols-1 gap-6 pt-1 sm:grid-cols-3 sm:gap-8">
                <div className="flex flex-col items-start gap-2">
                  <p className="font-medium text-slate-700">DogShift</p>
                  <Link href="/" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                    Accueil
                  </Link>
                  <Link href="/search" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                    Trouver un dogsitter
                  </Link>
                  <Link href="/devenir-dogsitter" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                    Devenir dogsitter
                  </Link>
                </div>

                <div className="flex flex-col items-start gap-2">
                  <p className="font-medium text-slate-700">Légal</p>
                  <Link href="/mentions-legales" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                    Mentions légales
                  </Link>
                  <Link href="/cgu" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                    Conditions générales (CGU)
                  </Link>
                  <Link href="/confidentialite" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                    Politique de confidentialité
                  </Link>
                </div>

                <div className="flex flex-col items-start gap-2">
                  <p className="font-medium text-slate-700">Support</p>
                  <a href="mailto:support@dogshift.ch" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                    Contact
                  </a>
                  <a href="mailto:support@dogshift.ch" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                    support@dogshift.ch
                  </a>
                </div>
              </div>
            </div>
            <p className="font-medium text-slate-700">© 2026 DogShift</p>
          </div>
        </div>
      </footer>
    </>
  );
}
