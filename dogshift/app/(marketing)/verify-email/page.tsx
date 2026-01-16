import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

function normalizeEmail(email: string) {
  return email.replace(/\s+/g, "+").trim().toLowerCase();
}

function hashToken(rawToken: string, secret: string) {
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

function tokenFingerprint(token: string) {
  try {
    const crypto = require("crypto") as typeof import("crypto");
    return crypto.createHash("sha256").update(token).digest("hex").slice(0, 10);
  } catch {
    return "unknown";
  }
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const sp = await Promise.resolve(searchParams);
  const tokenParam = sp?.token;
  const rawToken = Array.isArray(tokenParam) ? (tokenParam[0] ?? "") : tokenParam ?? "";
  const token = rawToken.trim();

  const emailParam = sp?.email;
  const emailRaw = Array.isArray(emailParam) ? (emailParam[0] ?? "") : emailParam ?? "";
  const email = normalizeEmail(emailRaw);
  const fp = token ? tokenFingerprint(token) : "missing";

  const okCard = "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8";
  const pageWrap = "mx-auto w-full max-w-2xl px-4 py-10 sm:py-14";
  const title = "text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl";
  const body = "mt-3 text-sm leading-6 text-slate-600";
  const btnPrimary =
    "inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800";
  const btnSecondary =
    "inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50";

  const render = (opts: {
    headline: string;
    message: string;
    tone: "success" | "error";
    cta?: { href: string; label: string };
    secondary?: { href: string; label: string };
  }) => {
    const badgeBase = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";
    const badge =
      opts.tone === "success"
        ? `${badgeBase} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200`
        : `${badgeBase} bg-rose-50 text-rose-700 ring-1 ring-rose-200`;

    return (
      <div className={pageWrap}>
        <div className={okCard}>
          <div className={badge}>{opts.tone === "success" ? "Email vérifié" : "Vérification impossible"}</div>
          <h1 className={title}>{opts.headline}</h1>
          <p className={body}>{opts.message}</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {opts.cta ? (
              <Link href={opts.cta.href} className={btnPrimary}>
                {opts.cta.label}
              </Link>
            ) : null}
            {opts.secondary ? (
              <Link href={opts.secondary.href} className={btnSecondary}>
                {opts.secondary.label}
              </Link>
            ) : (
              <Link href="/" className={btnSecondary}>
                Retour à l’accueil
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!token) {
    console.warn("[email-verification] confirm refused: missing_token");
    return render({
      tone: "error",
      headline: "Lien de vérification invalide",
      message: "Ce lien de vérification est incomplet. Demande un nouveau lien depuis tes paramètres.",
      cta: { href: "/account/settings", label: "Aller aux paramètres" },
    });
  }

  if (!email) {
    console.warn("[email-verification] confirm refused: missing_email", { fp });
    return render({
      tone: "error",
      headline: "Lien de vérification invalide",
      message: "Ce lien de vérification est incomplet. Demande un nouveau lien depuis tes paramètres.",
      cta: { href: "/account/settings", label: "Aller aux paramètres" },
    });
  }

  const secret = process.env.NEXTAUTH_SECRET || "";
  if (!secret) {
    console.error("[email-verification] confirm refused: missing_secret");
    return render({
      tone: "error",
      headline: "Service indisponible",
      message: "La configuration du service ne permet pas de vérifier cet email pour le moment.",
      secondary: { href: "/login", label: "Se connecter" },
    });
  }

  const hashed = hashToken(token, secret);

  const record = await prisma.verificationToken.findFirst({
    where: {
      token: hashed,
      identifier: email,
    },
  });

  if (!record) {
    const user = await prisma.user.findUnique({ where: { email }, select: { emailVerified: true } });
    if (user?.emailVerified) {
      console.info("[email-verification] confirm refused: already_used", { fp, email });
      return render({
        tone: "success",
        headline: "Email déjà vérifié",
        message: "Ton adresse email est déjà confirmée. Tu peux continuer normalement.",
        cta: { href: "/account/settings?verified=1", label: "Continuer" },
      });
    }

    console.warn("[email-verification] confirm refused: not_found", { fp, email });
    return render({
      tone: "error",
      headline: "Lien de vérification invalide ou expiré",
      message: "Ce lien n’est plus valide. Demande un nouveau lien depuis tes paramètres.",
      cta: { href: "/account/settings", label: "Aller aux paramètres" },
    });
  }

  const expires = record.expires instanceof Date ? record.expires.getTime() : new Date(record.expires).getTime();
  if (!Number.isFinite(expires) || Date.now() > expires) {
    await prisma.verificationToken.deleteMany({ where: { token: hashed } });
    console.warn("[email-verification] confirm refused: expired", { fp, email: String(record.identifier ?? "") });
    return render({
      tone: "error",
      headline: "Lien expiré",
      message: "Ce lien de vérification a expiré. Demande un nouvel email depuis tes paramètres.",
      cta: { href: "/account/settings", label: "Renvoyer un email" },
    });
  }

  const recordEmail = normalizeEmail(String(record.identifier ?? ""));
  if (!recordEmail) {
    await prisma.verificationToken.deleteMany({ where: { token: hashed } });
    console.warn("[email-verification] confirm refused: missing_identifier", { fp });
    return render({
      tone: "error",
      headline: "Lien de vérification invalide",
      message: "Ce lien n’est pas valide. Demande un nouveau lien depuis tes paramètres.",
      cta: { href: "/account/settings", label: "Aller aux paramètres" },
    });
  }

  if (recordEmail !== email) {
    console.warn("[email-verification] confirm refused: email_mismatch", { fp, recordEmail, email });
    return render({
      tone: "error",
      headline: "Lien de vérification invalide",
      message: "Ce lien ne correspond pas à cette adresse email. Demande un nouveau lien depuis tes paramètres.",
      cta: { href: "/account/settings", label: "Aller aux paramètres" },
    });
  }

  await prisma.user.updateMany({
    where: { email },
    data: { emailVerified: new Date() },
  });

  await prisma.verificationToken.deleteMany({ where: { token: hashed } });

  console.info("[email-verification] confirm success", { fp, email });

  return render({
    tone: "success",
    headline: "Email vérifié",
    message: "Merci. Ton adresse email a bien été confirmée.",
    cta: { href: "/account/settings?verified=1", label: "Aller aux paramètres" },
    secondary: { href: "/", label: "Retour à l’accueil" },
  });
}
