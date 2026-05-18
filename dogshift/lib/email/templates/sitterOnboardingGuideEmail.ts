/**
 * DogShift — sitter onboarding guide email
 *
 * Sent in two contexts:
 *   1. Immediately after a sitter redeems their activation code → "welcome,
 *      here's what's left to publish your profile" (Phase 4 of the address
 *      rollout, triggered from app/api/host/activation-code/route.ts)
 *   2. Progressive nudges from the daily cron (J+1, J+3, J+7, J+14) when the
 *      profile is still below 100% completion
 *
 * The body is a checklist mapping `ProfileCompletionChecks` → actionable items
 * with deep-links. Done items are shown checked + greyed out so the sitter
 * sees their progress, not just their gaps.
 */
import {
  computeSitterProfileCompletionDetails,
  type ProfileCompletionChecks,
} from "@/lib/sitterCompletion";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export type OnboardingNudgeStage = "welcome" | "day_1" | "day_3" | "day_7" | "day_14";

const STAGE_LABELS: Record<OnboardingNudgeStage, { heroLabel: string; subject: string; title: string; subtitle: string; heroColor: "purple" | "amber" }> = {
  welcome: {
    heroLabel: "BIENVENUE",
    subject: "Bienvenue dans la communauté DogShift — voici tes prochaines étapes",
    title: "Plus que quelques étapes",
    subtitle: "Avant que les propriétaires puissent te réserver, complète ton profil.",
    heroColor: "purple",
  },
  day_1: {
    heroLabel: "ÉTAPE SUIVANTE",
    subject: "Il te manque quelques étapes pour publier ton profil DogShift",
    title: "Ton profil n'est pas encore visible",
    subtitle: "Tu es à mi-chemin — il te reste quelques infos à compléter.",
    heroColor: "purple",
  },
  day_3: {
    heroLabel: "RAPPEL",
    subject: "Rappel : ton profil DogShift attend d'être publié",
    title: "Reprends ton onboarding en 5 minutes",
    subtitle: "On t'aide à passer à l'étape suivante.",
    heroColor: "purple",
  },
  day_7: {
    heroLabel: "UNE SEMAINE PLUS TARD",
    subject: "DogShift — ton profil n'est toujours pas publié",
    title: "Besoin d'aide pour finir ?",
    subtitle: "Réponds à cet email si quelque chose te bloque.",
    heroColor: "amber",
  },
  day_14: {
    heroLabel: "DERNIER RAPPEL",
    subject: "Dernier rappel — ton compte DogShift sera mis en pause si tu ne publies pas",
    title: "Profil toujours pas publié",
    subtitle: "Sans publication dans les prochains jours, ton compte sera mis en pause par notre équipe.",
    heroColor: "amber",
  },
};

type ChecklistItem = {
  key: keyof ProfileCompletionChecks;
  label: string;
  /** Path relative to baseUrl. Each item deep-links to the page that lets the sitter fix it. */
  href: string;
};

const CHECKLIST: ChecklistItem[] = [
  { key: "identity", label: "Prénom + ville renseignés", href: "/host/profile/edit" },
  { key: "address", label: "Adresse postale renseignée", href: "/host/profile/edit" },
  { key: "avatar", label: "Photo de profil ajoutée", href: "/host/profile/edit" },
  { key: "bio", label: "Bio rédigée", href: "/host/profile/edit" },
  { key: "services", label: "Services activés (Promenade / Garde / Pension)", href: "/host/profile/edit" },
  { key: "pricing", label: "Tarifs définis pour chaque service activé", href: "/host/profile/edit" },
  { key: "dogSizes", label: "Tailles de chiens acceptées", href: "/host/profile/edit" },
  { key: "stripeConnected", label: "Compte Stripe Connect activé (pour recevoir les paiements)", href: "/host/profile/edit" },
];

export type SitterOnboardingGuideParams = {
  /** Used in the email greeting */
  firstName: string;
  /** Profile snapshot — fields must match computeSitterProfileCompletionDetails input */
  profile: unknown;
  /** Which nudge in the sequence we're sending */
  stage: OnboardingNudgeStage;
  /** Absolute origin (https://www.dogshift.ch in prod) */
  baseUrl?: string;
};

export type RenderedOnboardingEmail = {
  subject: string;
  text: string;
  html: string;
};

export function renderSitterOnboardingGuideEmail(
  params: SitterOnboardingGuideParams,
): RenderedOnboardingEmail {
  const baseUrl = (params.baseUrl || "https://www.dogshift.ch").replace(/\/$/, "");
  const firstName = (params.firstName ?? "").trim() || "Dogsitter";
  const stage = STAGE_LABELS[params.stage];
  const { percent, checks } = computeSitterProfileCompletionDetails(params.profile);

  const remaining = CHECKLIST.filter((item) => !checks[item.key]);
  const completed = CHECKLIST.filter((item) => checks[item.key]);

  // Build the checklist HTML — items à faire en haut, complétés grisés en bas
  const checklistRows: string[] = [];

  if (remaining.length > 0) {
    checklistRows.push(
      `<p style="margin:0 0 8px 0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#dc2626;">À faire (${remaining.length})</p>`,
    );
    for (const item of remaining) {
      checklistRows.push(
        `<div style="margin:0 0 10px 0;padding:12px 14px;background:#fef2f2;border-left:3px solid #ef4444;border-radius:6px;">` +
          `<span style="font-size:14px;color:#991b1b;">❌ <strong>${item.label}</strong></span>` +
          `<br><a href="${baseUrl}${item.href}" style="font-size:13px;color:#6366f1;text-decoration:underline;">→ Compléter cette étape</a>` +
          `</div>`,
      );
    }
  }

  if (completed.length > 0) {
    checklistRows.push(
      `<p style="margin:18px 0 8px 0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#16a34a;">Déjà fait (${completed.length})</p>`,
    );
    for (const item of completed) {
      checklistRows.push(
        `<div style="margin:0 0 6px 0;padding:10px 14px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:6px;">` +
          `<span style="font-size:14px;color:#166534;text-decoration:line-through;opacity:0.75;">✓ ${item.label}</span>` +
          `</div>`,
      );
    }
  }

  const extraHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.6;">
      Bonjour ${firstName},
    </p>
    <p style="margin:0 0 18px 0;font-size:15px;color:#374151;line-height:1.6;">
      Ton compte sitter DogShift est <strong>activé</strong> 🎉 — mais ton profil n'est pas encore publié dans la recherche.
      Voici où tu en es :
    </p>
    <div style="margin:0 0 22px 0;padding:14px 18px;background:#eef2ff;border-radius:10px;text-align:center;">
      <div style="font-size:32px;font-weight:700;color:#4338ca;">${percent}%</div>
      <div style="font-size:13px;color:#6366f1;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-top:4px;">Profil complété</div>
    </div>
    ${checklistRows.join("\n")}
    <p style="margin:22px 0 0 0;font-size:13px;color:#64748b;line-height:1.5;">
      Une fois <strong>100% complété</strong>, ton profil apparaîtra dans les résultats de recherche et tu pourras recevoir tes premières réservations.
    </p>
  `;

  const { html } = renderEmailLayout({
    audience: "sitter",
    heroLabel: stage.heroLabel,
    heroColor: stage.heroColor,
    title: stage.title,
    subtitle: stage.subtitle,
    extraHtml,
    ctaLabel: "Compléter mon profil maintenant",
    ctaUrl: `${baseUrl}/host/profile/edit`,
    footerText:
      "Tu reçois cet email parce que ton compte sitter DogShift est activé mais ton profil n'est pas encore publié. " +
      "Réponds à cet email à tout moment pour de l'aide.",
  });

  // Plain-text fallback — keeps it short, lists remaining items
  const lines: string[] = [
    `Bonjour ${firstName},`,
    "",
    `Ton compte sitter DogShift est activé, mais ton profil n'est pas encore publié.`,
    `Profil complété : ${percent}%`,
    "",
  ];
  if (remaining.length > 0) {
    lines.push("À faire :");
    for (const item of remaining) lines.push(`  - ${item.label}`);
    lines.push("");
  }
  if (completed.length > 0) {
    lines.push("Déjà fait :");
    for (const item of completed) lines.push(`  + ${item.label}`);
    lines.push("");
  }
  lines.push(`Compléter mon profil : ${baseUrl}/host/profile/edit`);
  lines.push("");
  lines.push("L'équipe DogShift");

  return { subject: stage.subject, text: lines.join("\n"), html };
}
