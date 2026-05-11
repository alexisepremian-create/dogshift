/**
 * Admin user directory — replaces the user-listing piece of the Clerk
 * dashboard now that DogShift owns its own auth via Auth.js v5.
 *
 * Server-rendered. Read-only for the v1 of this page (no inline edits or
 * destructive actions). Auth-focused columns first (email, role, sign-up
 * date, email verified, auth method, has-password) followed by activity
 * counts. Search filters on email/name, role filter, and auth-method
 * filter.
 *
 * Row click → goes to the existing role-specific detail page so we don't
 * have to duplicate the per-user UI right away:
 *   - role=SITTER → /admin/sitters/[user.id-or-sitterId]
 *   - role=OWNER  → /admin/owners/[user.id]
 *   - role=ADMIN  → no detail page yet, just show the row inert
 */
import Link from "next/link";
import { Role } from "@prisma/client";

import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(value)
    .replaceAll(".", "-");
}

type AuthMethodFilter = "all" | "credentials" | "google" | "google-only" | "no-password";

function parseQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value ?? "";
  return raw.trim();
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("/admin/users");

  const sp = await searchParams;
  const q = parseQuery(sp?.q);
  const roleFilter = parseQuery(sp?.role).toUpperCase();
  const authMethodRaw = parseQuery(sp?.auth).toLowerCase();
  const authMethod: AuthMethodFilter = (
    ["all", "credentials", "google", "google-only", "no-password"] as const
  ).includes(authMethodRaw as AuthMethodFilter)
    ? (authMethodRaw as AuthMethodFilter)
    : "all";

  const validRole = (["OWNER", "SITTER", "ADMIN"] as const).includes(
    roleFilter as "OWNER" | "SITTER" | "ADMIN",
  )
    ? (roleFilter as Role)
    : null;

  const users = await prisma.user.findMany({
    where: {
      ...(validRole ? { role: validRole } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      emailVerified: true,
      passwordHash: true,
      sitterId: true,
      accounts: { select: { provider: true } },
      sitterProfile: { select: { id: true, lifecycleStatus: true, published: true } },
      _count: {
        select: { bookings: true, dogProfiles: true, sitterBookings: true },
      },
    },
  });

  // ── Stats over the unfiltered fetched set (before auth-method filter) ───
  const totalUsers = users.length;
  const ownerCount = users.filter((u) => u.role === "OWNER").length;
  const sitterCount = users.filter((u) => u.role === "SITTER").length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const verifiedCount = users.filter((u) => u.emailVerified !== null).length;
  const hasPasswordCount = users.filter((u) => u.passwordHash !== null).length;
  const googleLinkedCount = users.filter((u) =>
    u.accounts.some((a) => a.provider === "google"),
  ).length;
  const noPasswordCount = users.filter(
    (u) => u.passwordHash === null && !u.accounts.some((a) => a.provider === "google"),
  ).length;

  // ── Apply the auth-method filter in-memory (cheap since take=500) ───────
  const visible = users.filter((u) => {
    if (authMethod === "all") return true;
    const hasGoogle = u.accounts.some((a) => a.provider === "google");
    const hasPassword = u.passwordHash !== null;
    switch (authMethod) {
      case "credentials":
        return hasPassword;
      case "google":
        return hasGoogle;
      case "google-only":
        return hasGoogle && !hasPassword;
      case "no-password":
        return !hasPassword && !hasGoogle;
      default:
        return true;
    }
  });

  function authMethodLabel(
    u: (typeof users)[number],
  ): { tag: string; tone: "ok" | "warn" | "neutral" } {
    const hasGoogle = u.accounts.some((a) => a.provider === "google");
    const hasPassword = u.passwordHash !== null;
    if (hasGoogle && hasPassword) return { tag: "Google + mot de passe", tone: "ok" };
    if (hasGoogle) return { tag: "Google uniquement", tone: "ok" };
    if (hasPassword) return { tag: "Mot de passe", tone: "ok" };
    return { tag: "Aucune méthode — reset requis", tone: "warn" };
  }

  function detailHref(u: (typeof users)[number]): string | null {
    if (u.role === "SITTER") {
      const target = u.sitterProfile?.id ? u.id : u.id;
      return `/admin/sitters/${target}`;
    }
    if (u.role === "OWNER") return `/admin/owners/${u.id}`;
    return null;
  }

  const sectionTitleStyle = "text-xs font-medium uppercase tracking-wider text-slate-500";

  return (
    <AdminShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Utilisateurs</h1>
          <p className="text-sm text-slate-600">
            Vue centrale sur les {totalUsers} comptes — état d&apos;authentification, rôle et activité.
            Permet de tracer qui s&apos;est inscrit, quelle méthode d&apos;auth (Google ou mot de passe),
            et de naviguer vers la fiche détaillée selon le rôle.
          </p>
        </header>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={totalUsers} />
          <StatCard label="Owners" value={ownerCount} />
          <StatCard label="Sitters" value={sitterCount} />
          <StatCard label="Admins" value={adminCount} />
          <StatCard
            label="Email vérifié"
            value={`${verifiedCount} / ${totalUsers}`}
            tone={verifiedCount === totalUsers ? "ok" : "neutral"}
          />
          <StatCard
            label="Avec mot de passe"
            value={`${hasPasswordCount} / ${totalUsers}`}
            tone="neutral"
          />
          <StatCard
            label="Google lié"
            value={`${googleLinkedCount} / ${totalUsers}`}
            tone="neutral"
          />
          <StatCard
            label="Aucune méthode"
            value={`${noPasswordCount}`}
            tone={noPasswordCount > 0 ? "warn" : "ok"}
          />
        </section>

        {/* ── Filtres ──────────────────────────────────────────────── */}
        <form
          method="GET"
          action="/admin/users"
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col">
            <label htmlFor="q" className={sectionTitleStyle}>
              Recherche
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="email ou nom"
              className="mt-1 w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="role" className={sectionTitleStyle}>
              Rôle
            </label>
            <select
              id="role"
              name="role"
              defaultValue={validRole ?? ""}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Tous</option>
              <option value="OWNER">Owner</option>
              <option value="SITTER">Sitter</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="auth" className={sectionTitleStyle}>
              Méthode auth
            </label>
            <select
              id="auth"
              name="auth"
              defaultValue={authMethod}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">Toutes</option>
              <option value="credentials">Avec mot de passe</option>
              <option value="google">Google lié</option>
              <option value="google-only">Google uniquement (sans pw)</option>
              <option value="no-password">Aucune méthode</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Filtrer
          </button>
          {(q || validRole || authMethod !== "all") && (
            <Link
              href="/admin/users"
              className="text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            >
              Réinitialiser
            </Link>
          )}
        </form>

        {/* ── Tableau ──────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Email vérifié</th>
                <th className="px-4 py-3">Méthode auth</th>
                <th className="px-4 py-3">Sitter status</th>
                <th className="px-4 py-3">Inscrit le</th>
                <th className="px-4 py-3">Activité</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                    Aucun utilisateur ne correspond aux filtres.
                  </td>
                </tr>
              ) : (
                visible.map((u) => {
                  const auth = authMethodLabel(u);
                  const href = detailHref(u);
                  const lifecycle = u.sitterProfile?.lifecycleStatus ?? null;
                  const published = u.sitterProfile?.published ?? false;
                  const activityBits = [
                    u._count.bookings > 0 ? `${u._count.bookings} bookings` : null,
                    u._count.sitterBookings > 0 ? `${u._count.sitterBookings} as sitter` : null,
                    u._count.dogProfiles > 0 ? `${u._count.dogProfiles} chiens` : null,
                  ].filter(Boolean);
                  return (
                    <tr key={u.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.email}</td>
                      <td className="px-4 py-3 text-slate-700">{u.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {u.emailVerified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            ✓ <span className="text-xs text-slate-500">{formatDate(u.emailVerified)}</span>
                          </span>
                        ) : (
                          <span className="text-amber-700">Non vérifié</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            auth.tone === "ok"
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : auth.tone === "warn"
                                ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                                : "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
                          }`}
                        >
                          {auth.tag}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {u.sitterProfile ? (
                          <span className="text-xs">
                            <span className="font-medium text-slate-900">{lifecycle ?? "—"}</span>
                            {published ? (
                              <span className="ml-1 text-emerald-700">· publié</span>
                            ) : (
                              <span className="ml-1 text-slate-500">· non publié</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {activityBits.length === 0 ? "—" : activityBits.join(" · ")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {href ? (
                          <Link
                            href={href}
                            className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
                          >
                            Détail →
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          Limité aux 500 derniers comptes (ordre d&apos;inscription décroissant). Utilise la
          recherche pour cibler un compte précis au-delà de cette limite.
        </p>
      </div>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "warn" | "neutral";
}) {
  const ring =
    tone === "ok"
      ? "ring-emerald-200"
      : tone === "warn"
        ? "ring-amber-200"
        : "ring-slate-200";
  const valueColor =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : "text-slate-900";
  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${ring}`}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueColor}`}>{value}</div>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const styles =
    role === "ADMIN"
      ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
      : role === "SITTER"
        ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
        : "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {role}
    </span>
  );
}
