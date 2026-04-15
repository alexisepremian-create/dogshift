"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f9fc] px-4 py-16 text-center">

      {/* Icon */}
      <div className="relative mb-8 flex items-center justify-center">
        <span
          className="select-none text-[10rem] leading-none opacity-10"
          aria-hidden="true"
          style={{ color: "#2f4d6b" }}
        >
          🐾
        </span>
        <span
          className="absolute text-5xl font-black leading-none"
          style={{ color: "#2f4d6b" }}
        >
          500
        </span>
      </div>

      {/* Message */}
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Une erreur est survenue
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
        Quelque chose s&apos;est mal passé de notre côté. Notre équipe a été
        automatiquement notifiée. Veuillez réessayer dans quelques instants.
      </p>

      {/* CTA */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-11 items-center justify-center rounded-2xl px-7 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[.98]"
          style={{ backgroundColor: "#2f4d6b" }}
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[.98]"
        >
          Retour à l&apos;accueil
        </Link>
      </div>

      {/* Brand footer */}
      <p className="mt-16 text-xs text-slate-400">
        <span className="font-semibold" style={{ color: "#2f4d6b" }}>DogShift</span>
        {" "}— Dog-sitting premium en Suisse
      </p>
    </div>
  );
}
