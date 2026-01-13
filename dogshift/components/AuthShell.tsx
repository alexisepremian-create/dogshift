import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import SunCornerGlow from "@/components/SunCornerGlow";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | null;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(11,77,140,0.12),transparent_60%),radial-gradient(900px_circle_at_100%_10%,rgba(250,204,21,0.18),transparent_55%),linear-gradient(to_bottom,rgba(248,250,252,1),rgba(241,245,249,1))]">
      <SunCornerGlow variant="ownerDashboard" intensity={0.85} />

      <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(15,23,42,0.12),transparent_65%)]" />
        <div className="absolute -right-24 top-24 hidden h-[520px] w-[520px] sm:block">
          <Image src="/hero-illustration.svg" alt="" fill className="object-contain" priority={false} />
        </div>
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href="/" className="inline-flex items-center" aria-label="Accueil DogShift">
          <Image src="/dogshift-logo.png" alt="DogShift" width={170} height={40} className="h-9 w-auto" priority />
        </Link>
        <Link href="/" className="text-sm font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
          Retour accueil
        </Link>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-[600px] flex-col px-6 pb-16 pt-10 sm:pt-14">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70">
            <Image src="/dogshift-logo.png" alt="" fill className="object-contain p-1.5" priority={false} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900 sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
        </div>

        <div className="mt-10 w-full">{children}</div>
      </div>
    </main>
  );
}
