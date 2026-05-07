# DogShift — Système d'emails transactionnels

> **Pour agents IA** : Ce document est la source de vérité pour créer ou modifier tout email dans DogShift. Lis-le entièrement avant de toucher à n'importe quel email.

---

## Architecture générale

```
lib/email/
├── sendEmail.ts                  # Envoi réel (Resend primary, SMTP fallback, console.log en dev)
├── templates/
│   └── layout.ts                 # renderEmailLayout() — l'unique template HTML partagé par TOUS les emails

lib/notifications/
└── sendNotificationEmail.ts      # Router central : kind → HTML + sujet + texte brut (emails booking/messaging)

lib/pensionVerificationAgent.ts   # sendPensionResultEmail() — emails vérification pension

app/api/cron/
├── inactivity-check/route.ts     # 4 builders d'emails d'inactivité
├── review-requests/route.ts      # Email "notez votre sitter"
├── sitter-booking-reminders/route.ts  # Rappel sitter J-1
├── sitter-monthly-recap/route.ts # Récap mensuel sitter
├── relance-owners/route.ts       # Déclenche l'agent relance
└── lead-nurturing/route.ts       # Séquence nurturing (leads non convertis)

app/api/agents/
├── onboarding-owner/route.ts     # Email bienvenue propriétaire (admin/Maestro)
└── relance-owner/route.ts        # Email relance IA via Claude

app/api/auth/
└── resolve-redirect/route.ts    # Email bienvenue automatique (1er login owner)

app/api/admin/
└── email-preview/route.ts       # Previews admin (mocks) — jamais envoyés en prod
```

---

## Le layout universel : `renderEmailLayout()`

**Règle absolue** : TOUS les emails DogShift utilisent `renderEmailLayout()`. Ne jamais créer de HTML email from scratch.

### Import
```typescript
import { renderEmailLayout } from "@/lib/email/templates/layout";
```

### Signature complète
```typescript
const { html } = renderEmailLayout({
  // ── Identité ──────────────────────────────────────────────
  logoUrl?: string;               // URL absolue du logo (obligatoire en prod)
  brandName?: string;             // "DogShift" par défaut

  // ── Hero (bandeau violet en haut) ─────────────────────────
  heroLabel?: string;             // Badge uppercase ex: "RÉSERVATION CONFIRMÉE"
  heroColor?: "purple" | "amber"; // purple par défaut, amber pour alertes urgentes
  title: string;                  // OBLIGATOIRE — grand titre blanc dans le hero
  subtitle?: string;              // Texte plus petit sous le titre

  // ── Contenu de la carte blanche ───────────────────────────
  summaryTitle?: string;          // Titre du tableau récapitulatif
  summaryRows?: { label: string; value: string }[];  // Lignes du récap
  extraHtml?: string;             // HTML libre injecté dans la carte (corps principal)

  // ── CTA principal ─────────────────────────────────────────
  ctaLabel?: string;              // Texte du bouton
  ctaUrl?: string;                // URL du bouton

  // ── Lien secondaire ───────────────────────────────────────
  secondaryLinkLabel?: string;
  secondaryLinkUrl?: string;

  // ── Bannière de fermeture ─────────────────────────────────
  audience?: "owner" | "sitter"; // IMPORTANT — détermine la photo du footer
  bannerImageUrl?: string;        // Override de la photo (optionnel)
  bannerCtaLabel?: string;
  bannerCtaUrl?: string;

  // ── Footer ────────────────────────────────────────────────
  footerText?: string;            // Texte légal/contexte sous la bannière
  footerLinks?: { label: string; url: string }[];
});
```

### `audience` — TOUJOURS le préciser

| Valeur | Photo bannière | CTA bannière |
|--------|---------------|--------------|
| `"owner"` (défaut) | `/email-banners/banner-confiance.jpg` | "Voir les dog-sitters →" |
| `"sitter"` | `/email-banners/banner-hero.jpg` | "Aller vers mon espace →" |

> **Règle** : tout email destiné à un sitter doit avoir `audience: "sitter"`.

---

## Typography & style dans `extraHtml`

### Police
Toujours définir `FF` localement et l'utiliser sur chaque balise :
```typescript
const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
```

### Paragraphes
```html
<div style="font-family:${FF};font-size:14px;line-height:22px;color:#374151;">
  <p style="margin:0 0 12px 0;">Bonjour ${firstName},</p>
  <p style="margin:0 0 16px 0;">Corps du message ici.</p>
</div>
```

### Blocs de conseils (tips) — avec dots colorés CSS

Remplace les listes à puces et les emojis. **Jamais d'emoji dans les emails DogShift.**

```typescript
// Définir les dots nécessaires selon le contexte
const dot = (color: string) =>
  `<td valign="top" style="padding:8px 10px 0 0;width:10px;"><div style="width:10px;height:10px;border-radius:50%;background:${color};"></div></td>`;

const D_INDIGO = dot("#818cf8");  // neutre / informatif
const D_GREEN  = dot("#4ade80");  // positif / succès
const D_AMBER  = dot("#fbbf24");  // avertissement
const D_RED    = dot("#f87171");  // urgent / refus
const D_SLATE  = dot("#94a3b8");  // secondaire
```

Structure du bloc :
```html
<div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
  <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Titre de section</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tr>${D_INDIGO}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Titre item</strong> — description de l'action ou du conseil.</td></tr>
    <tr>${D_INDIGO}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Autre item</strong> — autre conseil.</td></tr>
  </table>
</div>
```

Variante avertissement (fond amber) :
```html
<div style="margin-top:20px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:18px 20px;">
  <div style="...;color:#92400e;...">Titre avertissement</div>
  <table ...>
    <tr>${D_AMBER}<td style="...;color:#78350f;">...</td></tr>
  </table>
</div>
```

Variante danger (fond rouge) :
```html
<div style="margin-top:20px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:18px 20px;">
  <div style="...;color:#991b1b;...">Titre danger</div>
  <table ...>
    <tr>${D_RED}<td style="...;color:#7f1d1d;">...</td></tr>
  </table>
</div>
```

---

## Données personnalisées — règles d'or

### Noms des personnes
```typescript
// Propriétaire
const ownerName = user.name?.trim() || "le propriétaire";
const firstName = user.name?.trim().split(/\s+/)[0] || "";
const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

// Sitter
const sitterName = (profile.displayName ?? user.name ?? "").trim();
const firstName = sitterName.split(/\s+/)[0] || "";
const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
```

**Ne jamais écrire** : `|| "Bonjour"` comme prénom → cela produit "Bonjour Bonjour,"

### Nom du chien
Le chien d'une réservation vient de `Booking.dogProfileId → selectedDog` :
```typescript
const booking = await prisma.booking.findUnique({
  where: { id: bookingId },
  select: {
    selectedDog: { select: { name: true, breed: true, weightKg: true } },
    // ...
  },
});
const dogName = booking.selectedDog?.name || "votre chien";
```

`DogProfile` a les champs : `name` (requis), `breed`, `birthYear`, `weightKg`, `medications`, `allergies`, `behaviorNotes`, `feedingNotes`, `sitterInstructions`, `photoUrl`, `neutered`, `isDefault`.

### Avis anonymes
```typescript
// NE PAS exposer le vrai nom si anonymous: true
const ownerDisplayName = anonymous
  ? "Un propriétaire"
  : user.name?.trim() || "Un propriétaire";
```

---

## Envoi d'un email

### Via `sendNotificationEmail` (booking, messages)
```typescript
import { sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";

await sendNotificationEmail({
  req,                              // NextRequest (pour les préférences)
  recipientUserId: string,          // ID user DB (pas Clerk ID)
  key: "nomDeLaClé",               // Clé de déduplication
  entityId: string,                 // ID entité (bookingId, etc.)
  payload: { kind: "nomDuKind", bookingId, ...autres },
});
```

### Via `sendEmail` directement (emails admin, onboarding, etc.)
```typescript
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
const logoUrl = `${APP_URL}/dogshift-logo.png`;

const { html } = renderEmailLayout({
  logoUrl,
  audience: "owner",  // ou "sitter"
  title: "Titre de l'email",
  extraHtml: `<div style="font-family:${FF};...">...</div>`,
  ctaLabel: "Label bouton",
  ctaUrl: `${APP_URL}/chemin`,
  footerText: "Contexte de réception de cet email.",
});

await sendEmail({
  to: email,
  subject: "Sujet de l'email",
  html,
  text: "Version texte brut de l'email.",
});
```

---

## Ajout d'un nouveau `kind` dans `sendNotificationEmail`

1. Ajouter le type dans l'union `EmailKind` (début du fichier)
2. Ajouter le `key` dans `DEDUPE_KEYS` si nécessaire
3. Ajouter le cas dans le `switch` pour construire le HTML/sujet/texte
4. Déclencher l'envoi depuis le bon endroit (route API, `setBookingStatus`, webhook Stripe)
5. Ajouter le case de preview dans `app/api/admin/email-preview/route.ts`
6. Ajouter l'entrée dans le catalogue admin `app/(protected)/admin/emails/page.tsx`

---

## Checklist avant de commit un email

- [ ] `renderEmailLayout()` utilisé (pas de HTML from scratch)
- [ ] `logoUrl` passé avec l'URL absolue
- [ ] `audience` précisé (`"owner"` ou `"sitter"`)
- [ ] `FF` défini et utilisé sur tous les éléments `extraHtml`
- [ ] Aucun emoji (ni dans le sujet, ni dans le body, ni dans le footerText)
- [ ] Dots CSS pour les listes, pas de `<ul><li>` bruts
- [ ] Noms issus de la DB (jamais hardcodés)
- [ ] Fallback propre si nom vide (`""` jamais `"Bonjour"` comme prénom)
- [ ] `anonymous: true` respecté (avis → "Un propriétaire")
- [ ] Preview admin mis à jour dans `email-preview/route.ts`
- [ ] Catalogue admin mis à jour dans `admin/emails/page.tsx`
- [ ] Version `text` brut fournie à `sendEmail()`
