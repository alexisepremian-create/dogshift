/**
 * Daily profile health check — autonomous agent.
 *
 * Walks every (User, SitterProfile?) pair in three phases:
 *
 *   1. Data invariants (lib/agents/profileHealthInvariants.ts)
 *   2. Safe auto-fixes for the few invariants flagged autoFixable
 *   3. Synthetic HTTP probes against public routes (lib/agents/profileHealthProbes.ts)
 *
 * Every run produces a Telegram recap (maintenance bot) using the canonical
 * format helpers — sorted by severity, with auto-fix counts and the full
 * list of remaining critical issues. The recap is sent unconditionally
 * (even when everything is green — "proof of work" pattern, matches
 * bug-regression-check at 02:07 UTC).
 *
 * One AgentLog row per UTC day, keyed by `actionType: <YYYY-MM-DD>`. Bypass
 * with `?force=1` plus a valid CRON_SECRET or MAINTENANCE_API_KEY bearer.
 */

import { NextResponse } from "next/server";

import {
  getIssueLabel,
  planAutoFix,
  runProfileHealthChecks,
  type ProfileHealthIssue,
  type ProfileSnapshot,
} from "@/lib/agents/profileHealthInvariants";
import {
  MAX_SITTER_PROBES,
  buildPublicProbes,
  buildSitterProfileProbes,
  runProbe,
  type ProbeResult,
} from "@/lib/agents/profileHealthProbes";
import { reportApiError } from "@/lib/observability/reportApiError";
import { prisma } from "@/lib/prisma";
import {
  pluralFR,
  riskRank,
  tgFooter,
  tgHeader,
  tgMessage,
  tgSection,
} from "@/lib/telegram/format";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

export const runtime = "nodejs";
export const maxDuration = 300;

const AGENT_NAME = "profile-health";
// Force the www subdomain — the apex (dogshift.ch) is redirected/blocked by
// the proxy in prod, which would make every probe fail with a 308/403 even
// though the user-facing site works fine.
function normalizeBaseUrl(raw: string | undefined): string {
  const url = (raw ?? "").trim() || "https://www.dogshift.ch";
  return url.replace(/^https?:\/\/dogshift\.ch/i, "https://www.dogshift.ch").replace(/\/+$/, "");
}
const BASE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);

async function ensurePrismaWarm(): Promise<void> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      return;
    } catch (err) {
      lastErr = err;
      const isInitErr =
        err instanceof Error &&
        (err.name === "PrismaClientInitializationError" ||
          /can't reach database|connection|timeout/i.test(err.message));
      if (!isInitErr) throw err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr ?? new Error("Prisma warm-up failed");
}

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date());
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const cronBearer = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const maintBearer = `Bearer ${(process.env.MAINTENANCE_API_KEY ?? "").trim()}`;
  const isAuthorized =
    (process.env.CRON_SECRET && authHeader === cronBearer) ||
    (process.env.MAINTENANCE_API_KEY && authHeader === maintBearer);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensurePrismaWarm();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reportApiError({
      kind: "internal_error",
      route: "cron/profile-health-check",
      extra: { stage: "warmup", error: message },
    });
    return NextResponse.json({ success: false, error: "DB unreachable" }, { status: 503 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const key = todayKey();

  if (!force) {
    const already = await prisma.agentLog.findFirst({
      where: { agentName: AGENT_NAME, actionType: key, status: "success" },
    });
    if (already) {
      return NextResponse.json({ success: true, skipped: true, reason: "already-ran-today" });
    }
  }

  const startedAt = Date.now();

  try {
    // ── Phase 1 + 2 : invariants + auto-fix ──────────────────────────────
    const users = await prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        sitterId: true,
        hostProfileJson: true,
        sitterProfile: {
          select: {
            id: true,
            sitterId: true,
            published: true,
            lifecycleStatus: true,
            verificationStatus: true,
            stripeAccountStatus: true,
            termsAcceptedAt: true,
            termsVersion: true,
            services: true,
            dogSizes: true,
            pricing: true,
            avatarUrl: true,
            profileCompletion: true,
            city: true,
            displayName: true,
            bio: true,
          },
        },
      },
    });

    let ownersScanned = 0;
    let sittersScanned = 0;
    const allIssues: ProfileHealthIssue[] = [];
    const fixedCounts: Record<string, number> = {};

    for (const u of users) {
      if (u.sitterProfile) sittersScanned++;
      else ownersScanned++;

      const snap: ProfileSnapshot = {
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          sitterId: u.sitterId,
          hostProfileJson: u.hostProfileJson,
        },
        sitterProfile: u.sitterProfile
          ? {
              ...u.sitterProfile,
              profileCompletion: u.sitterProfile.profileCompletion ?? null,
            }
          : null,
      };

      const issues = runProfileHealthChecks(snap);
      for (const iss of issues) {
        if (iss.autoFixable) {
          const plan = planAutoFix(iss, snap);
          if (plan) {
            try {
              // Round-trip through JSON so the data shape is `InputJsonValue`
              // -compatible. Prisma's strict Json type rejects raw
              // `Record<string, unknown>` even when the contents are valid JSON
              // — same reason we did this for the AuditLog metadata field.
              // This is what was causing SERVICES_DESYNC fixes to fail silently
              // in the very first prod run (15 issues reported instead of 0).
              const safeData = JSON.parse(JSON.stringify(plan.data));
              if (plan.table === "sitterProfile") {
                await prisma.sitterProfile.update({ where: plan.where, data: safeData });
              } else {
                await prisma.user.update({ where: plan.where, data: safeData });
              }
              await prisma.auditLog.create({
                data: {
                  action: "system.profile_health_autofix",
                  actorType: "system",
                  actorId: "system",
                  targetId: u.id,
                  targetType: "USER",
                  metadata: { check: iss.id, plan: safeData },
                },
              });
              iss.fixed = true;
              fixedCounts[iss.id] = (fixedCounts[iss.id] ?? 0) + 1;
            } catch (err) {
              // Auto-fix failed — leave the issue in the recap with the reason
              // exposed so we can debug the next run.
              iss.fixed = false;
              iss.fixDetails = { error: err instanceof Error ? err.message : String(err) };
              console.error("[profile-health] autofix failed", {
                userId: u.id,
                check: iss.id,
                error: iss.fixDetails.error,
              });
            }
          }
        }
        allIssues.push(iss);
      }
    }

    // ── Phase 3 : synthetic HTTP probes ──────────────────────────────────
    // Only run probes in production to avoid hammering preview environments
    // and to keep the probe URL stable across runs.
    const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

    let probes: ProbeResult[] = [];
    if (isProd) {
      const publishedSitterIds = users
        .filter((u) => u.sitterProfile?.published && u.sitterProfile.sitterId)
        .map((u) => u.sitterProfile!.sitterId)
        .slice(0, MAX_SITTER_PROBES);

      const allProbes = [
        ...buildPublicProbes(BASE_URL),
        ...buildSitterProfileProbes(BASE_URL, publishedSitterIds),
      ];
      probes = await Promise.all(allProbes.map((p) => runProbe(p)));
    }

    // ── Build the Telegram recap ─────────────────────────────────────────
    // Goal : a founder can scan this in 10 seconds. No CONSTANT_CASE IDs, no
    // "hostProfileJson" jargon, no JSON in the body. Auto-fixed issues get
    // a one-liner. Remaining issues are grouped by check (15 sitters with the
    // same problem = one section, not 15 lines), sorted by urgency, with a
    // concrete next step.
    const unfixedIssues = allIssues.filter((i) => !i.fixed);
    const failedProbes = probes.filter((p) => !p.ok);
    const fixedTotal = Object.values(fixedCounts).reduce((a, b) => a + b, 0);
    const durationMs = Date.now() - startedAt;

    // Group remaining issues by check ID so 15 SERVICES_DESYNC don't make
    // the message a wall of text.
    const grouped = new Map<string, ProfileHealthIssue[]>();
    for (const iss of unfixedIssues) {
      const list = grouped.get(iss.id) ?? [];
      list.push(iss);
      grouped.set(iss.id, list);
    }
    const groupedSorted = Array.from(grouped.entries()).sort(([a], [b]) => {
      const sa = grouped.get(a)![0].severity;
      const sb = grouped.get(b)![0].severity;
      return riskRank(sa) - riskRank(sb);
    });

    const overall = unfixedIssues.length === 0 && failedProbes.length === 0 ? "🟢" : unfixedIssues.some((i) => i.severity === "high") || failedProbes.length > 0 ? "🔴" : "🟡";
    const headline =
      unfixedIssues.length === 0 && failedProbes.length === 0
        ? "Tout va bien."
        : unfixedIssues.some((i) => i.severity === "high")
          ? "Action requise."
          : "Quelques points à surveiller.";

    const sections: Array<string | string[] | null> = [
      tgHeader("🩺", "DogShift — santé des profils", new Date()),
      `${overall} <b>${headline}</b>`,

      [
        tgSection("📊", "Résumé"),
        `• ${pluralFR(sittersScanned, "dogsitter scanné", "dogsitters scannés")}`,
        `• ${pluralFR(ownersScanned, "propriétaire scanné", "propriétaires scannés")}`,
        fixedTotal > 0
          ? `• ${pluralFR(fixedTotal, "correction auto", "corrections auto")} appliquée${fixedTotal > 1 ? "s" : ""}`
          : "• Aucune correction automatique nécessaire",
        `• ${pluralFR(unfixedIssues.length, "point à regarder", "points à regarder")}`,
        `• Durée : ${Math.max(1, Math.round(durationMs / 1000))}s`,
      ],

      fixedTotal === 0
        ? null
        : [
            tgSection("✅", `Corrections automatiques (${fixedTotal})`),
            ...Object.entries(fixedCounts).map(([id, n]) => {
              const lbl = getIssueLabel(id);
              return `• ${lbl.title} — ${pluralFR(n, "compte concerné", "comptes concernés")}`;
            }),
          ],

      groupedSorted.length === 0
        ? null
        : groupedSorted.flatMap(([id, list]) => {
            const lbl = getIssueLabel(id);
            const sev = list[0].severity;
            const emoji = sev === "high" ? "🔴" : sev === "medium" ? "🟡" : "🟢";
            const emails = list
              .map((i) => i.targetEmail ?? i.userId)
              .slice(0, 8)
              .join(", ");
            const more = list.length > 8 ? ` (+${list.length - 8})` : "";
            return [
              `${emoji} <b>${lbl.title}</b>`,
              `<i>${lbl.explain}</i>`,
              `👤 ${pluralFR(list.length, "compte concerné", "comptes concernés")} : ${emails}${more}`,
              `👉 ${lbl.action}`,
              "", // blank line between groups for readability
            ];
          }),

      failedProbes.length === 0
        ? null
        : [
            tgSection("🌐", `Pages publiques en erreur (${failedProbes.length})`),
            ...failedProbes.map((p) => `🔴 ${p.url} — ${p.error ?? `HTTP ${p.status}`}`),
            `👉 Vérifier la page dans le navigateur et regarder les logs Vercel.`,
          ],

      probes.length > 0 && failedProbes.length === 0
        ? [`🌐 ${pluralFR(probes.length, "page publique vérifiée", "pages publiques vérifiées")} — toutes OK.`]
        : null,

      [`🔗 Détails et actions : ${BASE_URL}/admin/profile-health`],

      tgFooter(new Date()),
    ];

    const message = tgMessage(sections);
    const telegramSent = await sendTelegramMessage(message, { bot: "maintenance" });

    // ── Persist AgentLog ─────────────────────────────────────────────────
    await prisma.agentLog.create({
      data: {
        agentName: AGENT_NAME,
        actionType: key,
        status: "success",
        summary: `${sittersScanned + ownersScanned} profils scannés, ${fixedTotal} auto-corrigés, ${unfixedIssues.length} issues restantes, ${failedProbes.length} probes en échec`,
        durationMs,
        details: {
          sittersScanned,
          ownersScanned,
          fixedCounts,
          unfixedIssues: unfixedIssues.slice(0, 100).map((i) => ({
            userId: i.userId,
            targetEmail: i.targetEmail,
            check: i.id,
            severity: i.severity,
            message: i.message,
          })),
          probes: probes.map((p) => ({
            name: p.name,
            ok: p.ok,
            status: p.status,
            durationMs: p.durationMs,
            error: p.error,
          })),
          telegramSent,
          today: key,
        },
      },
    });

    return NextResponse.json({
      success: true,
      sittersScanned,
      ownersScanned,
      fixed: Object.values(fixedCounts).reduce((a, b) => a + b, 0),
      issues: unfixedIssues.length,
      probesFailed: failedProbes.length,
      telegramSent,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reportApiError({
      kind: "internal_error",
      code: "PROFILE_HEALTH_FAILED",
      route: "cron/profile-health-check",
      extra: { error: message },
    });
    await prisma.agentLog.create({
      data: {
        agentName: AGENT_NAME,
        actionType: key,
        status: "error",
        summary: `Erreur: ${message.slice(0, 200)}`,
        durationMs: Date.now() - startedAt,
        details: { error: message, today: key },
      },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Allow POST too — convenient for ops triggers via curl without a header.
export const POST = GET;
