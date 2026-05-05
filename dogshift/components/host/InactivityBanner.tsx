"use client";

import Link from "next/link";
import { AlertTriangle, XOctagon, Clock } from "lucide-react";

type Props = {
  inactivityStatus: string | null;
};

export default function InactivityBanner({ inactivityStatus }: Props) {
  if (!inactivityStatus || inactivityStatus === "nudge_sent") {
    // nudge_sent: the email is sent but no in-dashboard banner yet
    return null;
  }

  if (inactivityStatus === "suspended") {
    return (
      <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <XOctagon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-900">Votre compte est suspendu</p>
            <p className="mt-1 text-sm text-red-700">
              Votre profil a été suspendu pour inactivité : aucune disponibilité n&apos;était renseignée depuis trop longtemps.
              Votre profil n&apos;est plus visible dans les résultats de recherche.
            </p>
            <p className="mt-2 text-sm text-red-700">
              Pour réactiver votre compte, contactez le support à{" "}
              <a href="mailto:support@dogshift.ch" className="font-semibold underline underline-offset-2">
                support@dogshift.ch
              </a>
              {" "}en précisant votre adresse e-mail.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (inactivityStatus === "warning_2") {
    return (
      <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-900">🚨 Dernier avertissement — suspension imminente</p>
            <p className="mt-1 text-sm text-red-700">
              Votre compte sera suspendu dans les prochains jours si vous n&apos;ajoutez pas de disponibilités.
              En cas de suspension, vous devrez contacter le support pour débloquer votre compte.
            </p>
            <Link
              href="/host/availability"
              className="mt-3 inline-flex items-center rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
            >
              Ajouter mes disponibilités maintenant
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (inactivityStatus === "warning_1") {
    return (
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">⚠️ Avertissement — votre compte sera suspendu</p>
            <p className="mt-1 text-sm text-amber-800">
              Votre profil est publié mais aucune disponibilité n&apos;est renseignée.
              Si vous n&apos;en ajoutez pas rapidement, votre compte sera suspendu pour inactivité.
            </p>
            <Link
              href="/host/availability"
              className="mt-3 inline-flex items-center rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition"
            >
              Gérer mes disponibilités
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
