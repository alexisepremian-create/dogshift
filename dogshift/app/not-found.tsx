import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f9fc] px-4 py-16 text-center">

      {/* Paw illustration */}
      <div className="relative mb-8 flex items-center justify-center">
        <span
          className="select-none text-[10rem] leading-none opacity-10"
          aria-hidden="true"
          style={{ color: "#7c3aed" }}
        >
          🐾
        </span>
        <span
          className="absolute text-[5.5rem] font-black leading-none tracking-tight"
          style={{ color: "#7c3aed" }}
        >
          404
        </span>
      </div>

      {/* Message */}
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Cette page s&apos;est sauvée…
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
        Impossible de retrouver la page que vous cherchez. Elle a peut-être été
        déplacée, renommée ou n&apos;existe tout simplement pas.
      </p>

      {/* CTA */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-2xl px-7 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[.98]"
          style={{ backgroundColor: "#7c3aed" }}
        >
          Retour à l&apos;accueil
        </Link>
        <a
          href="mailto:contact@dogshift.ch"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[.98]"
        >
          Contacter le support
        </a>
      </div>

      {/* Brand footer */}
      <p className="mt-16 text-xs text-slate-400">
        <span className="font-semibold" style={{ color: "#7c3aed" }}>DogShift</span>
        {" "}— Dog-sitting premium en Suisse
      </p>
    </div>
  );
}
