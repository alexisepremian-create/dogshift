import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

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
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(900px circle at 15% 10%, rgba(11,77,140,0.12), transparent 60%), radial-gradient(800px circle at 90% 15%, rgba(250,204,21,0.16), transparent 55%)",
        }}
      />

      <header className="relative z-10">
        <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between px-6 py-5">
          <Link href="/" className="inline-flex items-center" aria-label="Accueil DogShift">
            <Image src="/dogshift-logo.png" alt="DogShift" width={170} height={40} className="h-9 w-auto" priority />
          </Link>
          <Link href="/" className="text-sm font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
            Retour accueil
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-screen-xl flex-col items-center px-6 pb-16 pt-10 sm:pt-14">
        <div className="w-full max-w-[520px]">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/70 text-slate-900">
              <span className="text-sm font-semibold">DS</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900 sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
          </div>

          <div className="mt-10 w-full max-w-[520px]">{children}</div>
        </div>
      </div>
    </main>
  );
}
