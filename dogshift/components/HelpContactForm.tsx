"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function HelpContactForm() {
  const { isLoaded, isSignedIn, user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  const disabled = status === "sending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const raw = (formData.get("message") ?? "") as string;
    const trimmed = String(raw).trim();
    if (!trimmed) {
      setErrorText("Merci d’écrire un message avant d’envoyer.");
      setStatus("error");
      return;
    }

    if (trimmed.length > 5000) {
      setErrorText("Votre message est trop long. Merci de le raccourcir.");
      setStatus("error");
      return;
    }

    setErrorText(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, email: userEmail }),
      });

      if (!res.ok) {
        let details: any = null;
        try {
          details = await res.json();
        } catch {
          details = null;
        }

        const code = typeof details?.errorCode === "string" && details.errorCode ? details.errorCode : null;
        const msg = typeof details?.errorMessage === "string" && details.errorMessage ? details.errorMessage : null;

        setErrorText(
          `Impossible d’envoyer votre message pour le moment.${code ? ` (${code})` : ""}${msg ? ` — ${msg}` : ""}`
        );
        setStatus("error");
        return;
      }

      setMessage("");
      setErrorText(null);
      setStatus("sent");
    } catch {
      setErrorText("Impossible d’envoyer votre message pour le moment.");
      setStatus("error");
    }
  }

  if (!isLoaded) {
    return null;
  }

  const canUseForm = isSignedIn && Boolean(userEmail);

  if (!canUseForm) {
    return (
      <div className="mt-6">
        <p className="text-sm font-semibold text-slate-900">Contacter le support</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Pour contacter le support DogShift, écris-nous à support@dogshift.ch
        </p>
        <a
          href="mailto:support@dogshift.ch"
          className="mt-4 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition md:hover:bg-slate-50"
        >
          Écrire au support
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6">
      <p className="text-sm font-semibold text-slate-900">Une question ? Écrivez-nous</p>

      <div className="mt-3">
        <textarea
          name="message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (status !== "sending") setStatus("idle");
            if (errorText) setErrorText(null);
          }}
          rows={5}
          placeholder="Décrivez votre question ou votre situation…"
          className="block w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_82%)]"
          disabled={disabled}
          aria-label="Message pour l’équipe DogShift"
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition-all duration-200 ease-out md:hover:bg-[var(--dogshift-blue-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "sending" ? "Envoi…" : "Envoyer"}
        </button>

        {status === "sent" ? (
          <p className="text-sm font-medium text-emerald-700">
            Merci pour votre message, notre équipe vous répondra dans les plus brefs délais.
          </p>
        ) : null}

        {status === "error" && errorText ? <p className="text-sm font-medium text-red-600">{errorText}</p> : null}
      </div>
    </form>
  );
}
