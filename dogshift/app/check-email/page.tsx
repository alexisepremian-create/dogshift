import Link from "next/link";

import AuthLayout from "@/components/auth/AuthLayout";

export const metadata = {
  title: "Vérifie ta boîte mail — DogShift",
  robots: { index: false, follow: false },
};

/**
 * "Check your inbox" page — wired into Auth.js v5 `verifyRequest`. Distinct
 * from /verify-email (which actually consumes the token from the email link).
 * Auth.js redirects sign-up flows here so the user knows to go check their
 * inbox.
 */
export default function CheckEmailPage() {
  return (
    <AuthLayout>
      <div className="mt-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Vérifie ta boîte mail
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          On vient de t&apos;envoyer un email avec un lien de confirmation. Clique dessus pour activer ton compte DogShift.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Pense à vérifier le dossier spam si tu ne le vois pas dans quelques minutes.
        </p>

        <div className="mt-8 space-y-3 text-sm">
          <Link
            href="/login"
            className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition hover:border-violet-400 hover:text-violet-700"
          >
            Aller à la connexion
          </Link>
          <p className="text-xs text-slate-500">
            Tu n&apos;as pas reçu l&apos;email ?{" "}
            <Link href="/forgot-password" className="text-violet-700 underline-offset-2 hover:underline">
              Renvoyer un lien
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
