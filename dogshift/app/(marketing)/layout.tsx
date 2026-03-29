import Link from "next/link";
import Image from "next/image";
import { Instagram, Facebook } from "lucide-react";

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
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-12">
            {/* Colonne Marque (Prend 2 colonnes sur grand écran) */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Link href="/" aria-label="DogShift" className="inline-flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--dogshift-blue)] text-white shadow-sm">
                  <Image src="/dogshift-logo-white.png" alt="DogShift" width={72} height={72} className="h-7 w-auto" />
                </span>
                <span className="text-xl font-bold tracking-tight text-slate-900">DogShift</span>
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                L'application intelligente qui connecte les propriétaires de chiens aux meilleurs dogsitters de confiance.
              </p>
              
              {/* Réseaux sociaux */}
              <div className="mt-4 flex items-center gap-3">
                <a
                  href="https://www.instagram.com/dogshift_ch/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Instagram DogShift"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=61578479756521"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Facebook DogShift"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Colonne Produit */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-900">Produit</h3>
              <div className="flex flex-col gap-3">
                <Link href="/" className="text-sm text-slate-500 transition-colors hover:text-slate-900">
                  Accueil
                </Link>
                <Link href="/search" className="text-sm text-slate-500 transition-colors hover:text-slate-900">
                  Trouver un dogsitter
                </Link>
                <Link href="/devenir-dogsitter" className="text-sm text-slate-500 transition-colors hover:text-slate-900">
                  Devenir dogsitter
                </Link>
                <Link href="/contribuer" className="text-sm text-slate-500 transition-colors hover:text-slate-900">
                  Soutenir le projet
                </Link>
              </div>
            </div>

            {/* Colonne Légal */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-900">Légal</h3>
              <div className="flex flex-col gap-3">
                <Link href="/mentions-legales" className="text-sm text-slate-500 transition-colors hover:text-slate-900">
                  Mentions légales
                </Link>
                <Link href="/cgu" className="text-sm text-slate-500 transition-colors hover:text-slate-900">
                  Conditions d'utilisation
                </Link>
                <Link href="/confidentialite" className="text-sm text-slate-500 transition-colors hover:text-slate-900">
                  Politique de confidentialité
                </Link>
              </div>
            </div>

            {/* Colonne Contact */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-900">Contact</h3>
              <div className="flex flex-col gap-3">
                <a href="mailto:support@dogshift.ch" className="text-sm text-slate-500 transition-colors hover:text-slate-900">
                  support@dogshift.ch
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200/70 pt-8 sm:flex-row">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <Link href="/confidentialite" className="hover:text-slate-900">
                Politique de confidentialité
              </Link>
              <Link href="/cgu" className="hover:text-slate-900">
                Conditions d'utilisation
              </Link>
            </div>
            <p className="text-xs text-slate-500">© 2026 DogShift. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
