import Link from "next/link";
import Image from "next/image";
import { Instagram, Facebook } from "lucide-react";

import DogShiftBot from "@/components/DogShiftBot";
import PageTopOffset from "@/components/PageTopOffset";
import SiteHeader from "@/components/SiteHeader";
import { VisaLogo, MastercardLogo, ApplePayLogo, TwintLogo } from "@/components/ui/PaymentIcons";

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
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                  <Image src="/dogshift-logo.png" alt="DogShift" width={72} height={72} className="h-8 w-auto" />
                </span>
                <span className="text-xl font-bold tracking-tight text-slate-900">DogShift</span>
              </Link>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                La plateforme de confiance pour confier votre chien en toute sérénité.
              </p>
              
              {/* Réseaux sociaux */}
              <div className="mt-4 flex flex-col gap-6">
                <div className="flex items-center gap-3">
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

                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium text-slate-400">Moyens de paiement acceptés :</p>
                  <div className="flex flex-wrap items-center gap-5 text-slate-400">
                    <VisaLogo className="h-8 w-auto transition-all duration-300 hover:text-[#1434CB]" />
                    <MastercardLogo className="h-7 w-auto grayscale transition-all duration-300 hover:grayscale-0" />
                    <ApplePayLogo className="h-6 w-auto transition-all duration-300 hover:text-slate-900" />
                    <TwintLogo className="h-6 w-auto transition-all duration-300 hover:text-[#000000]" />
                  </div>
                </div>
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

          <div className="mt-12 flex flex-col items-start justify-start gap-4 border-t border-slate-200/70 pt-8">
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
