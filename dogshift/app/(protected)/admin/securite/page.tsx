import { ShieldCheck, Lock, AlertTriangle, Eye, Server, Globe, Key, Bell, CheckCircle2 } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

type SecurityItem = {
  title: string;
  description: string;
  status: "ok" | "partial" | "advisory";
  detail?: string;
};

type SecurityCategory = {
  label: string;
  icon: React.ElementType;
  items: SecurityItem[];
};

const categories: SecurityCategory[] = [
  {
    label: "Authentification & Accès",
    icon: Lock,
    items: [
      {
        title: "Authentification Clerk",
        description: "Tous les utilisateurs s'authentifient via Clerk (leader du marché). Gestion des sessions, tokens JWT, et protection contre les attaques par force brute incluse nativement.",
        status: "ok",
      },
      {
        title: "Panel admin — double protection",
        description: "L'accès admin nécessite (1) une session Clerk active, (2) un code admin fort. Même si quelqu'un devine l'URL, il ne peut pas entrer sans les deux.",
        status: "ok",
      },
      {
        title: "Panel admin — whitelist email",
        description: "Seule l'adresse email autorisée (configurée dans ADMIN_EMAILS sur Vercel) peut créer une session admin. Même avec le bon code, un autre email est bloqué.",
        status: "ok",
      },
      {
        title: "Cookies sécurisés",
        description: "La session admin est stockée dans un cookie httpOnly (inaccessible depuis le JavaScript de la page) et secure (uniquement HTTPS). Protège contre le vol de session XSS.",
        status: "ok",
      },
      {
        title: "2FA sur tous les services critiques",
        description: "Double authentification activée sur Clerk, GitHub, Stripe, Vercel et Cloudflare. Même en cas de mot de passe compromis, le compte reste inaccessible.",
        status: "ok",
      },
    ],
  },
  {
    label: "Protection des APIs",
    icon: Server,
    items: [
      {
        title: "Vérification de propriété sur toutes les routes",
        description: "Chaque route API vérifie que l'utilisateur connecté est bien le propriétaire de la ressource qu'il modifie. Impossible de modifier les données d'un autre utilisateur.",
        status: "ok",
      },
      {
        title: "Rate limiting sur les routes publiques",
        description: "Les formulaires publics (contact, candidature sitter, vérification de code d'invitation) sont limités en nombre de requêtes par IP. Protège contre le spam et la force brute.",
        status: "ok",
        detail: "5 req/15min sur contact · 10 req/15min sur invites · 3 req/h sur candidatures · 5 req/10min sur admin",
      },
      {
        title: "Validation des entrées (Zod)",
        description: "Toutes les routes API critiques valident le body entrant via des schémas Zod avant d'accéder à la base de données ou à Stripe. Un body malformé retourne immédiatement une erreur 400 avec un message précis, sans jamais atteindre la logique métier.",
        status: "ok",
        detail: "8 routes couvertes — bookings · host/profile · pricing · set-password · account/settings · contact · sitter-applications · invites/verify",
      },
      {
        title: "Webhook Stripe signé",
        description: "Les webhooks Stripe (confirmation de paiement) vérifient une signature cryptographique. Impossible de simuler un faux paiement via l'API.",
        status: "ok",
      },
      {
        title: "Route debug-session admin uniquement",
        description: "La route /api/debug-session est restreinte aux admins. Elle ne peut pas être consultée par un utilisateur normal.",
        status: "ok",
      },
      {
        title: "Route auth/register désactivée",
        description: "L'ancien endpoint de création de compte (hors Clerk) est désactivé et répond 410 Gone. L'authentification passe exclusivement par Clerk.",
        status: "ok",
      },
    ],
  },
  {
    label: "Sécurité HTTP & Navigateur",
    icon: Globe,
    items: [
      {
        title: "Content Security Policy (CSP)",
        description: "Le navigateur n'autorise le chargement de scripts, styles et requêtes API que depuis les domaines explicitement listés (Clerk, Stripe, MapTiler, Google Ads). Bloque les injections XSS.",
        status: "ok",
        detail: "Services autorisés : Clerk · Stripe · MapTiler · Google Ads · Sentry",
      },
      {
        title: "HSTS — HTTPS forcé",
        description: "Le header Strict-Transport-Security force le navigateur à toujours utiliser HTTPS pendant 2 ans. Protège contre les attaques de type man-in-the-middle.",
        status: "ok",
      },
      {
        title: "X-Frame-Options",
        description: "Le site ne peut pas être chargé dans une iframe depuis un autre domaine. Protège contre le clickjacking (superposer une iframe invisible sur un bouton).",
        status: "ok",
      },
      {
        title: "X-Content-Type-Options",
        description: "Empêche le navigateur de deviner le type de fichier (MIME sniffing). Un fichier texte ne peut pas être exécuté comme script.",
        status: "ok",
      },
      {
        title: "Referrer-Policy",
        description: "Contrôle ce qui est envoyé dans le header Referer. L'URL complète n'est envoyée qu'aux pages du même domaine.",
        status: "ok",
      },
      {
        title: "Permissions-Policy",
        description: "Désactive l'accès à la caméra, au microphone et à la géolocalisation. Seul le paiement (Stripe) est autorisé.",
        status: "ok",
      },
    ],
  },
  {
    label: "Dépendances & Code",
    icon: ShieldCheck,
    items: [
      {
        title: "Next.js à jour",
        description: "Next.js est en version 16.2.3 (dernière stable). Une faille HIGH détectée sur la version précédente (16.0.10) a été corrigée.",
        status: "ok",
        detail: "16.0.10 → 16.2.3",
      },
      {
        title: "npm audit — vulnérabilités réduites",
        description: "Audit des dépendances effectué. 19 vulnérabilités détectées, 15 corrigées. Les 4 restantes sont dans next-auth/nodemailer (non exploitables car l'email provider n'est pas utilisé).",
        status: "partial",
        detail: "19 → 4 vulnérabilités · Les 4 restantes sont low/moderate dans des fonctionnalités non utilisées",
      },
      {
        title: "Pas d'injection SQL",
        description: "Toutes les requêtes base de données passent par Prisma ORM avec des requêtes paramétrées. Les rares requêtes SQL brutes utilisent des paramètres $1, $2… jamais d'interpolation directe.",
        status: "ok",
      },
    ],
  },
  {
    label: "Secrets & Clés API",
    icon: Key,
    items: [
      {
        title: "Variables d'environnement sensibles chiffrées",
        description: "Sur Vercel, l'option Sensitive Environment Variables est activée. Les secrets (DB, Stripe, SMTP…) sont chiffrés et ne peuvent plus être lus depuis le dashboard.",
        status: "ok",
      },
      {
        title: "Clé MapTiler restreinte au domaine",
        description: "La clé API MapTiler (visible côté client) est restreinte à dogshift.ch et www.dogshift.ch. Impossible de l'utiliser depuis un autre domaine.",
        status: "ok",
      },
      {
        title: "Secrets non exposés côté client",
        description: "Seules les variables préfixées NEXT_PUBLIC_ sont envoyées au navigateur. Ce sont des clés publiques par design (Clerk publishable key, Stripe publishable key, DSN Sentry).",
        status: "ok",
      },
      {
        title: "Rotation des secrets",
        description: "Bonne pratique : changer DATABASE_URL, SMTP_PASS et les clés critiques tous les 6-12 mois pour limiter l'impact d'une fuite passée non détectée.",
        status: "advisory",
        detail: "Dernière rotation : à planifier tous les 6-12 mois",
      },
    ],
  },
  {
    label: "Monitoring & Infrastructure",
    icon: Bell,
    items: [
      {
        title: "Sentry — monitoring d'erreurs",
        description: "Toutes les erreurs (front et serveur) sont capturées en temps réel sur dogshift.sentry.io. Alerte email automatique à chaque nouvelle erreur. Données stockées en EU.",
        status: "ok",
      },
      {
        title: "Cloudflare — protection réseau",
        description: "Le trafic passe par Cloudflare avant d'arriver sur Vercel. Protection DDoS, WAF (pare-feu applicatif), et rate limiting au niveau DNS configurés.",
        status: "ok",
      },
      {
        title: "Vercel Deployment Protection",
        description: "Les preview deployments (URLs de type dogshift-xxxx.vercel.app) sont protégés par authentification Vercel. Seuls les membres de l'équipe peuvent y accéder.",
        status: "ok",
      },
    ],
  },
];

function StatusBadge({ status }: { status: SecurityItem["status"] }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Actif
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Partiel
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Eye className="h-3 w-3" aria-hidden="true" />
      Recommandé
    </span>
  );
}

export default async function AdminSecuritePage() {
  await requireAdminPageAccess("/admin/securite");

  const totalItems = categories.flatMap((c) => c.items).length;
  const okItems = categories.flatMap((c) => c.items).filter((i) => i.status === "ok").length;
  const partialItems = categories.flatMap((c) => c.items).filter((i) => i.status === "partial").length;
  const advisoryItems = categories.flatMap((c) => c.items).filter((i) => i.status === "advisory").length;

  return (
    <AdminShell>
      <div className="grid gap-6">
        {/* Header */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sécurité</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Vue d'ensemble sécurité</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Récapitulatif de toutes les mesures de sécurité en place sur la plateforme DogShift. Aucune information sensible n'est affichée ici.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {okItems} mesures actives
            </div>
            {partialItems > 0 && (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {partialItems} partielles
              </div>
            )}
            {advisoryItems > 0 && (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
                <Eye className="h-4 w-4" aria-hidden="true" />
                {advisoryItems} recommandées
              </div>
            )}
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-500">
              {totalItems} points vérifiés
            </div>
          </div>
        </section>

        {/* Categories */}
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <section key={category.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100">
                  <Icon className="h-4 w-4 text-slate-700" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">{category.label}</h2>
              </div>
              <div className="mt-5 grid gap-3">
                {category.items.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                    {item.detail && (
                      <p className="mt-2 text-xs font-medium text-slate-500">{item.detail}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
