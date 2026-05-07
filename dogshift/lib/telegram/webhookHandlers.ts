/**
 * Telegram webhook command handlers — one per bot channel.
 *
 * Called by /api/telegram/webhook/[bot] after Telegram delivers a message.
 * Each bot has its own command set plus a universal /commandes command.
 * Security: only the authorized chat ID (from env vars) is served.
 */

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage, type TelegramBot } from "@/lib/telegram/sendTelegramMessage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    date: number;
    text?: string;
  };
};

type SendFn = (text: string, md?: boolean) => Promise<boolean>;

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function handleBotUpdate(bot: TelegramBot, update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.text) return;

  const chatId = String(message.chat.id);

  // Security: only respond to the authorised chat
  const suffix = bot.toUpperCase();
  const authorisedId = (
    process.env[`TELEGRAM_CHAT_ID_${suffix}`] ?? process.env.TELEGRAM_CHAT_ID ?? ""
  ).trim();
  if (authorisedId && chatId !== authorisedId) return;

  const text = message.text.trim();
  const commandMatch = text.match(/^\/([a-zA-Z_]+)/);
  if (!commandMatch) return;
  const command = commandMatch[1].toLowerCase();

  const send: SendFn = (t, md = true) =>
    sendTelegramMessage(t, { bot, chatId, parseMode: md ? "Markdown" : undefined });

  if (["start", "commandes", "help", "aide"].includes(command)) {
    await send(commandsText(bot));
    return;
  }

  switch (bot) {
    case "candidatures":  await handleCandidatures(command, send); break;
    case "verifications": await handleVerifications(command, send); break;
    case "relances":      await handleRelances(command, send);      break;
    case "maintenance":   await handleMaintenance(command, send);   break;
    case "news":          await handleNews(command, send);          break;
    case "reservations":  await handleReservations(command, send);  break;
  }
}

// ─── Command lists ────────────────────────────────────────────────────────────

function commandsText(bot: TelegramBot): string {
  const ADMIN_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch";
  switch (bot) {
    case "candidatures":
      return (
        `*Commandes — Bot Candidatures*\n\n` +
        `/candidatures — 5 dernières candidatures\n` +
        `/high — Candidatures HIGH (7 jours)\n` +
        `/review — Candidatures REVIEW (7 jours)\n` +
        `/sitters — Sitters en attente d'activation\n` +
        `/entretiens — Derniers entretiens Cal.com\n` +
        `/avis — Derniers avis reçus\n` +
        `/stats — Stats candidatures\n` +
        `/commandes — Cette liste\n\n` +
        `Panel : ${ADMIN_URL}/admin/sitter-applications`
      );
    case "verifications":
      return (
        `*Commandes — Bot Vérifications*\n\n` +
        `/pendantes — Vérifications identité en attente\n` +
        `/pension — Vérifications pension en attente\n` +
        `/opan — Certificats OPAn en attente\n` +
        `/stats — Stats des vérifications\n` +
        `/commandes — Cette liste\n\n` +
        `Panel : ${ADMIN_URL}/admin/verifications`
      );
    case "relances":
      return (
        `*Commandes — Bot Relances & Leads*\n\n` +
        `/leads — 5 derniers leads capturés\n` +
        `/inactifs — Sitters inactifs détectés\n` +
        `/onboarding — Derniers onboardings owners\n` +
        `/stats — Stats relances (7 jours)\n` +
        `/commandes — Cette liste`
      );
    case "maintenance":
      return (
        `*Commandes — Bot Maintenance*\n\n` +
        `/sante — Dernier scan nightly des dépendances\n` +
        `/rapport — Dernier rapport hebdomadaire\n` +
        `/agents — Statut global des agents (24h)\n` +
        `/commandes — Cette liste\n\n` +
        `Panel : ${ADMIN_URL}/admin/maintenance`
      );
    case "news":
      return (
        `*Commandes — Bot News*\n\n` +
        `/dernieres — 3 dernières veilles envoyées\n` +
        `/news — Déclencher une veille maintenant\n` +
        `/commandes — Cette liste`
      );
    case "reservations":
      return (
        `*Commandes — Bot Réservations*\n\n` +
        `/reservations — 5 dernières réservations\n` +
        `/stats — Stats réservations (7 jours)\n` +
        `/paiements — Paiements du mois en cours\n` +
        `/commandes — Cette liste\n\n` +
        `Panel : ${ADMIN_URL}/admin/bookings`
      );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-CH", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(d);
}

function fmtDateShort(d: Date): string {
  return new Intl.DateTimeFormat("fr-CH", {
    day: "2-digit", month: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(d);
}

function unknown(send: SendFn) {
  return send("Commande inconnue. Tape /commandes pour voir la liste.");
}

// ─── Candidatures ─────────────────────────────────────────────────────────────

async function handleCandidatures(command: string, send: SendFn): Promise<void> {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch";

  switch (command) {
    case "candidatures": {
      const apps = await prisma.pilotSitterApplication.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { firstName: true, lastName: true, city: true, status: true, createdAt: true },
      });
      if (!apps.length) { await send("Aucune candidature trouvée."); return; }
      const lines = apps.map((a, i) =>
        `${i + 1}. *${a.firstName} ${a.lastName}* — ${a.city}\n   Statut : ${a.status} — ${fmtDateShort(a.createdAt)}`
      );
      await send(`*5 dernières candidatures*\n\n${lines.join("\n\n")}\n\n${APP_URL}/admin/sitter-applications`);
      break;
    }

    case "high":
    case "review":
    case "low": {
      const keyword = command.toUpperCase();
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const logs = await prisma.agentLog.findMany({
        where: {
          agentName: "candidature",
          summary: { contains: `- ${keyword}` },
          status: "success",
          createdAt: { gte: since7d },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { summary: true, createdAt: true },
      });
      if (!logs.length) {
        await send(`Aucune candidature *${keyword}* cette semaine.`);
        return;
      }
      const lines = logs.map((l, i) =>
        `${i + 1}. ${l.summary.split("|")[0].trim()} — ${fmtDateShort(l.createdAt)}`
      );
      await send(`*Candidatures ${keyword} (7 derniers jours)*\n\n${lines.join("\n")}`);
      break;
    }

    case "sitters": {
      const profiles = await prisma.sitterProfile.findMany({
        where: { lifecycleStatus: { not: "activated" } },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      if (!profiles.length) { await send("Aucun sitter en attente d'activation."); return; }
      const lines = profiles.map((p, i) => {
        const name = p.user.name ?? p.user.email;
        return `${i + 1}. *${name}* — ${p.lifecycleStatus}`;
      });
      await send(`*Sitters en attente d'activation*\n\n${lines.join("\n")}\n\n${APP_URL}/admin/sitter-applications`);
      break;
    }

    case "entretiens": {
      const logs = await prisma.agentLog.findMany({
        where: { agentName: "calendrier", status: "success" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { summary: true, createdAt: true },
      });
      if (!logs.length) { await send("Aucun entretien Cal.com récent."); return; }
      const lines = logs.map((l, i) => `${i + 1}. ${l.summary} — ${fmtDateShort(l.createdAt)}`);
      await send(`*Derniers entretiens Cal.com*\n\n${lines.join("\n")}`);
      break;
    }

    case "avis": {
      const reviews = await prisma.review.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          rating: true,
          comment: true,
          createdAt: true,
          sitter: { select: { name: true } },
        },
      });
      if (!reviews.length) { await send("Aucun avis récent."); return; }
      const lines = reviews.map((r, i) => {
        const stars = r.rating >= 4 ? "⭐⭐⭐⭐⭐" : r.rating === 3 ? "⭐⭐⭐" : "⭐⭐";
        const comment = r.comment?.slice(0, 60) ?? "Aucun commentaire";
        return `${i + 1}. ${stars} — *${r.sitter.name ?? "sitter"}*\n   ${comment} (${fmtDateShort(r.createdAt)})`;
      });
      await send(`*Derniers avis*\n\n${lines.join("\n\n")}`);
      break;
    }

    case "stats": {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [total, todayCount, high, review, low, activated] = await Promise.all([
        prisma.pilotSitterApplication.count(),
        prisma.pilotSitterApplication.count({ where: { createdAt: { gte: today } } }),
        prisma.agentLog.count({ where: { agentName: "candidature", summary: { contains: "- HIGH" }, createdAt: { gte: since7d } } }),
        prisma.agentLog.count({ where: { agentName: "candidature", summary: { contains: "- REVIEW" }, createdAt: { gte: since7d } } }),
        prisma.agentLog.count({ where: { agentName: "candidature", summary: { contains: "- LOW" }, createdAt: { gte: since7d } } }),
        prisma.sitterProfile.count({ where: { lifecycleStatus: "activated" } }),
      ]);
      await send(
        `*Stats candidatures*\n\n` +
        `Aujourd'hui : ${todayCount}\n` +
        `Total historique : ${total}\n` +
        `Sitters activés : ${activated}\n\n` +
        `*Scores 7 derniers jours*\n` +
        `HIGH : ${high}  |  REVIEW : ${review}  |  LOW : ${low}`
      );
      break;
    }

    default:
      await unknown(send);
  }
}

// ─── Vérifications ────────────────────────────────────────────────────────────

async function handleVerifications(command: string, send: SendFn): Promise<void> {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch";

  switch (command) {
    case "pendantes": {
      const profiles = await prisma.sitterProfile.findMany({
        where: { verificationStatus: "pending" },
        include: { user: { select: { name: true } } },
        orderBy: { verificationSubmittedAt: "desc" },
        take: 5,
      });
      if (!profiles.length) { await send("Aucune vérification identité en attente."); return; }
      const lines = profiles.map((p, i) => {
        const date = p.verificationSubmittedAt ? fmtDateShort(p.verificationSubmittedAt) : "?";
        return `${i + 1}. *${p.user.name ?? "Inconnu"}* — soumis le ${date}`;
      });
      await send(`*Vérifications identité en attente*\n\n${lines.join("\n")}\n\n${APP_URL}/admin/verifications`);
      break;
    }

    case "pension": {
      const profiles = await prisma.sitterProfile.findMany({
        where: { pensionVerifStatus: "pending" },
        include: { user: { select: { name: true } } },
        orderBy: { pensionPhotoSubmittedAt: "desc" },
        take: 5,
      });
      if (!profiles.length) { await send("Aucune vérification pension en attente."); return; }
      const lines = profiles.map((p, i) => {
        const date = p.pensionPhotoSubmittedAt ? fmtDateShort(p.pensionPhotoSubmittedAt) : "?";
        return `${i + 1}. *${p.user.name ?? "Inconnu"}* — soumis le ${date}`;
      });
      await send(`*Vérifications pension en attente*\n\n${lines.join("\n")}\n\n${APP_URL}/admin/pension-verifications`);
      break;
    }

    case "opan": {
      const profiles = await prisma.sitterProfile.findMany({
        where: { maxDogsCertVerifStatus: "pending" },
        include: { user: { select: { name: true } } },
        orderBy: { maxDogsCertSubmittedAt: "desc" },
        take: 5,
      });
      if (!profiles.length) { await send("Aucun certificat OPAn en attente."); return; }
      const lines = profiles.map((p, i) => {
        const date = p.maxDogsCertSubmittedAt ? fmtDateShort(p.maxDogsCertSubmittedAt) : "?";
        return `${i + 1}. *${p.user.name ?? "Inconnu"}* — soumis le ${date}`;
      });
      await send(`*Certificats OPAn en attente*\n\n${lines.join("\n")}\n\n${APP_URL}/admin/verifications`);
      break;
    }

    case "stats": {
      const [pendingId, pendingPension, pendingOpan, approvedId, approvedPension] = await Promise.all([
        prisma.sitterProfile.count({ where: { verificationStatus: "pending" } }),
        prisma.sitterProfile.count({ where: { pensionVerifStatus: "pending" } }),
        prisma.sitterProfile.count({ where: { maxDogsCertVerifStatus: "pending" } }),
        prisma.sitterProfile.count({ where: { verificationStatus: "approved" } }),
        prisma.sitterProfile.count({ where: { pensionVerifStatus: "approved" } }),
      ]);
      await send(
        `*Stats vérifications*\n\n` +
        `Identité en attente : ${pendingId}\n` +
        `Pension en attente : ${pendingPension}\n` +
        `OPAn en attente : ${pendingOpan}\n\n` +
        `Identité approuvées : ${approvedId}\n` +
        `Pension approuvées : ${approvedPension}`
      );
      break;
    }

    default:
      await unknown(send);
  }
}

// ─── Relances ─────────────────────────────────────────────────────────────────

async function handleRelances(command: string, send: SendFn): Promise<void> {
  switch (command) {
    case "leads": {
      const leads = await prisma.leadMagnet.findMany({
        orderBy: { capturedAt: "desc" },
        take: 5,
        select: { prenom: true, email: true, source: true, capturedAt: true, nurturingStep: true },
      });
      if (!leads.length) { await send("Aucun lead récent."); return; }
      const lines = leads.map((l, i) =>
        `${i + 1}. *${l.prenom ?? l.email}* — ${l.source}\n   Étape nurturing : ${l.nurturingStep} — ${fmtDateShort(l.capturedAt)}`
      );
      await send(`*5 derniers leads*\n\n${lines.join("\n\n")}`);
      break;
    }

    case "inactifs": {
      const profiles = await prisma.sitterProfile.findMany({
        where: { published: true, inactivityStatus: { not: null } },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { updatedAt: "desc" },
        take: 8,
      });
      if (!profiles.length) { await send("Aucun sitter inactif détecté."); return; }
      const lines = profiles.map((p, i) => {
        const name = p.user.name ?? p.user.email;
        return `${i + 1}. *${name}* — ${p.inactivityStatus}`;
      });
      await send(`*Sitters inactifs*\n\n${lines.join("\n")}`);
      break;
    }

    case "onboarding": {
      const logs = await prisma.agentLog.findMany({
        where: { agentName: "onboarding-owner", status: "success" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { summary: true, createdAt: true },
      });
      if (!logs.length) { await send("Aucun onboarding owner récent."); return; }
      const lines = logs.map((l, i) => `${i + 1}. ${l.summary} — ${fmtDateShort(l.createdAt)}`);
      await send(`*Derniers onboardings owners*\n\n${lines.join("\n")}`);
      break;
    }

    case "stats": {
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [leads7d, leads30d, relances, inactifs, totalLeads] = await Promise.all([
        prisma.leadMagnet.count({ where: { capturedAt: { gte: since7d } } }),
        prisma.leadMagnet.count({ where: { capturedAt: { gte: since30d } } }),
        prisma.agentLog.count({ where: { agentName: "relance-owner", createdAt: { gte: since7d } } }),
        prisma.sitterProfile.count({ where: { published: true, inactivityStatus: { not: null } } }),
        prisma.leadMagnet.count(),
      ]);
      await send(
        `*Stats relances (7 jours)*\n\n` +
        `Nouveaux leads (7j) : ${leads7d}\n` +
        `Nouveaux leads (30j) : ${leads30d}\n` +
        `Total leads : ${totalLeads}\n` +
        `Relances owners envoyées : ${relances}\n` +
        `Sitters inactifs actifs : ${inactifs}`
      );
      break;
    }

    default:
      await unknown(send);
  }
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

async function handleMaintenance(command: string, send: SendFn): Promise<void> {
  switch (command) {
    case "sante": {
      const log = await prisma.agentLog.findFirst({
        where: { agentName: "deps-agent" },
        orderBy: { createdAt: "desc" },
        select: { summary: true, status: true, createdAt: true, durationMs: true },
      });
      if (!log) { await send("Aucun scan nightly trouvé."); return; }
      const icon = log.status === "success" ? "✅" : "❌";
      const dur = log.durationMs ? `${Math.round(log.durationMs / 1000)}s` : "?";
      await send(
        `*Dernier scan nightly*\n\n` +
        `${icon} ${log.status.toUpperCase()}\n` +
        `${log.summary}\n\n` +
        `Durée : ${dur}\n` +
        `Date : ${fmtDate(log.createdAt)}`
      );
      break;
    }

    case "rapport": {
      const log = await prisma.agentLog.findFirst({
        where: { agentName: "deps-weekly" },
        orderBy: { createdAt: "desc" },
        select: { summary: true, status: true, createdAt: true },
      });
      if (!log) { await send("Aucun rapport hebdo trouvé."); return; }
      const icon = log.status === "success" ? "✅" : "❌";
      await send(
        `*Dernier rapport hebdomadaire*\n\n` +
        `${icon} ${log.status.toUpperCase()}\n` +
        `${log.summary.slice(0, 400)}\n\n` +
        `Date : ${fmtDate(log.createdAt)}`
      );
      break;
    }

    case "agents": {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [total, errors] = await Promise.all([
        prisma.agentLog.count({ where: { createdAt: { gte: since24h } } }),
        prisma.agentLog.count({ where: { createdAt: { gte: since24h }, status: "error" } }),
      ]);
      const rate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
      const icon = rate >= 95 ? "✅" : rate >= 80 ? "⚠️" : "❌";
      await send(
        `*Statut agents (24h)*\n\n` +
        `${icon} Taux de succès : ${rate}%\n` +
        `Total exécutions : ${total}\n` +
        `Erreurs : ${errors}`
      );
      break;
    }

    default:
      await unknown(send);
  }
}

// ─── News ─────────────────────────────────────────────────────────────────────

async function handleNews(command: string, send: SendFn): Promise<void> {
  switch (command) {
    case "dernieres": {
      const logs = await prisma.agentLog.findMany({
        where: { agentName: "dog-news" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { summary: true, status: true, createdAt: true },
      });
      if (!logs.length) { await send("Aucune news envoyée récemment."); return; }
      const lines = logs.map((l, i) => {
        const icon = l.status === "success" ? "✅" : "❌";
        return `${i + 1}. ${icon} ${l.summary}\n   ${fmtDate(l.createdAt)}`;
      });
      await send(`*3 dernières veilles canines*\n\n${lines.join("\n\n")}`);
      break;
    }

    case "news": {
      await send("Déclenchement de la veille en cours...");
      const cronSecret = process.env.CRON_SECRET ?? "";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch";
      try {
        const res = await fetch(`${appUrl}/api/cron/dog-news`, {
          method: "GET",
          headers: { Authorization: `Bearer ${cronSecret}` },
        });
        if (res.ok) {
          await send("Veille déclenchée. Tu recevras les news dans quelques secondes.");
        } else {
          await send(`Erreur déclenchement : statut ${res.status}`);
        }
      } catch (err) {
        await send(`Erreur réseau : ${err instanceof Error ? err.message : String(err)}`);
      }
      break;
    }

    default:
      await unknown(send);
  }
}

// ─── Réservations ─────────────────────────────────────────────────────────────

async function handleReservations(command: string, send: SendFn): Promise<void> {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch";

  switch (command) {
    case "reservations": {
      const bookings = await prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          status: true,
          serviceType: true,
          amount: true,
          createdAt: true,
          user: { select: { name: true } },
          sitter: { select: { name: true } },
        },
      });
      if (!bookings.length) { await send("Aucune réservation trouvée."); return; }
      const lines = bookings.map((b, i) => {
        const chf = (b.amount / 100).toFixed(2);
        return (
          `${i + 1}. *${b.status}* — ${b.serviceType ?? "?"}\n` +
          `   ${b.user.name ?? "?"} → ${b.sitter.name ?? "?"}\n` +
          `   CHF ${chf} — ${fmtDateShort(b.createdAt)}`
        );
      });
      await send(`*5 dernières réservations*\n\n${lines.join("\n\n")}\n\n${APP_URL}/admin/bookings`);
      break;
    }

    case "stats": {
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [total7d, paid7d, cancelled7d, totalRevenue, totalAll] = await Promise.all([
        prisma.booking.count({ where: { createdAt: { gte: since7d } } }),
        prisma.booking.count({ where: { createdAt: { gte: since7d }, status: "PAID" } }),
        prisma.booking.count({ where: { createdAt: { gte: since7d }, status: "CANCELLED" } }),
        prisma.booking.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
        prisma.booking.count(),
      ]);
      const revenue = ((totalRevenue._sum.amount ?? 0) / 100).toFixed(2);
      await send(
        `*Stats réservations (7j)*\n\n` +
        `Nouvelles : ${total7d}\n` +
        `Payées : ${paid7d}\n` +
        `Annulées : ${cancelled7d}\n` +
        `Total historique : ${totalAll}\n\n` +
        `CA total (payé) : CHF ${revenue}`
      );
      break;
    }

    case "paiements": {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const paid = await prisma.booking.findMany({
        where: { status: "PAID", paidAt: { gte: startOfMonth } },
        orderBy: { paidAt: "desc" },
        take: 5,
        select: {
          amount: true,
          paidAt: true,
          serviceType: true,
          user: { select: { name: true } },
          sitter: { select: { name: true } },
        },
      });
      if (!paid.length) { await send("Aucun paiement ce mois."); return; }
      const lines = paid.map((b, i) => {
        const chf = (b.amount / 100).toFixed(2);
        return `${i + 1}. CHF ${chf} — ${b.user.name ?? "?"} → ${b.sitter.name ?? "?"} (${fmtDateShort(b.paidAt!)})`;
      });
      const monthTotal = paid.reduce((s, b) => s + b.amount, 0);
      await send(
        `*Paiements ce mois*\n\n` +
        `${lines.join("\n")}\n\n` +
        `Total affiché : CHF ${(monthTotal / 100).toFixed(2)}`
      );
      break;
    }

    default:
      await unknown(send);
  }
}
