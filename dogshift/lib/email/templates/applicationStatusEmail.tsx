import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties } from "react";

import {
  applicationStatusEmailDefaultPreviewText,
  type ApplicationStatusEmailStatus,
} from "./applicationStatusEmailContent";

export {
  applicationStatusEmailSubject,
  applicationStatusEmailPlainText,
} from "./applicationStatusEmailContent";
export type { ApplicationStatusEmailStatus } from "./applicationStatusEmailContent";

// ── Social SVGs (footer) ──────────────────────────────────────────────────────
const SVG_INSTAGRAM = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="6" stroke="#94a3b8" stroke-width="1.8"/><circle cx="12" cy="12" r="4" stroke="#94a3b8" stroke-width="1.8"/><circle cx="17.5" cy="6.5" r="1" fill="#94a3b8"/></svg>`;
const SVG_FACEBOOK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_GLOBE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#94a3b8" stroke-width="1.8"/><path d="M12 2c-2.5 3-4 6-4 10s1.5 7 4 10M12 2c2.5 3 4 6 4 10s-1.5 7-4 10M2 12h20" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/></svg>`;

// ── Hero configs per status ───────────────────────────────────────────────────
const HERO: Record<ApplicationStatusEmailStatus, { label: string; title: (name: string) => string; subtitle: string }> = {
  HIGH: {
    label: "PROFIL RETENU",
    title: (name) => `Félicitations${name ? ` ${name}` : ""}\u00A0!`,
    subtitle: "Ton profil correspond parfaitement à ce que nous cherchons pour la phase pilote DogShift.",
  },
  REVIEW: {
    label: "EN COURS D'EXAMEN",
    title: () => "Ta candidature est à l'étude",
    subtitle: "Nous prenons le temps d'examiner ton profil en détail avant de te répondre.",
  },
  LOW: {
    label: "MISE À JOUR",
    title: () => "Merci pour ta candidature",
    subtitle: "Merci pour l'intérêt que tu portes à DogShift.",
  },
};

export function ApplicationStatusEmail(props: {
  baseUrl?: string;
  firstName: string;
  lastName: string;
  status: ApplicationStatusEmailStatus;
  calendlyLink?: string;
  previewText?: string;
}) {
  const baseUrl = (props.baseUrl || "https://www.dogshift.ch").trim().replace(/\/$/, "");
  const logoUrl = `${baseUrl}/dogshift-logo.png`;
  const firstName = (props.firstName || "").trim();
  const calendlyLink = (props.calendlyLink || "").trim();
  const previewText = (props.previewText || applicationStatusEmailDefaultPreviewText(props.status)).trim();
  const hero = HERO[props.status] || HERO.LOW;

  return (
    <Html lang="fr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body className="ds-outer" style={s.body}>
        <Container style={s.container}>

          {/* Logo */}
          <Section style={s.logoSection}>
            <Link href={baseUrl} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "10px" }}>
              <Img src={logoUrl} width={36} height={36} alt="" style={{ display: "block", borderRadius: 8 }} />
              <Text style={s.brandName}>DogShift</Text>
            </Link>
          </Section>

          {/* Purple hero */}
          <Section style={s.hero}>
            <div style={s.heroLabel}>{hero.label}</div>
            <Text style={s.heroTitle}>{hero.title(firstName)}</Text>
            <Text style={s.heroSubtitle}>{hero.subtitle}</Text>
          </Section>

          {/* White card */}
          <Section className="ds-card" style={s.card}>
            <div style={s.cardBody}>
              {props.status === "HIGH" ? (
                <StatusHigh firstName={firstName} calendlyLink={calendlyLink} />
              ) : props.status === "REVIEW" ? (
                <StatusReview firstName={firstName} />
              ) : (
                <StatusLow firstName={firstName} />
              )}
            </div>
          </Section>

          {/* Footer */}
          <Section style={s.footerSection}>
            <div style={s.socialRow}>
              <a href="https://instagram.com/dogshift" style={s.socialLink} dangerouslySetInnerHTML={{ __html: SVG_INSTAGRAM }} />
              <a href="https://facebook.com/dogshift" style={s.socialLink} dangerouslySetInnerHTML={{ __html: SVG_FACEBOOK }} />
              <a href={baseUrl} style={s.socialLink} dangerouslySetInnerHTML={{ __html: SVG_GLOBE }} />
            </div>
            <div style={s.divider} />
            <Text style={s.footerText}>
              DogShift &middot; support@dogshift.ch &middot; Plateforme de dogsitting premium en Suisse
            </Text>
            <Text style={s.footerText}>
              <Link href={baseUrl} style={s.footerLink}>dogshift.ch</Link>
              &nbsp;&middot;&nbsp;
              <Link href="mailto:support@dogshift.ch" style={s.footerLink}>support@dogshift.ch</Link>
              &nbsp;&middot;&nbsp;
              <Link href={`${baseUrl}/unsubscribe`} style={{ ...s.footerLink, textDecoration: "underline" }}>Se désabonner</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// ── Per-status body content ───────────────────────────────────────────────────

function StatusHigh({ firstName, calendlyLink }: { firstName: string; calendlyLink: string }) {
  return (
    <>
      <Text style={s.bodyText}>
        Bonne nouvelle{firstName ? ` ${firstName}` : ""}&nbsp;! Pour finaliser ta candidature, nous organisons un court entretien de{" "}
        <strong>15 minutes</strong>. C&apos;est une étape <strong>obligatoire</strong> avant l&apos;activation de ton profil.
      </Text>
      {calendlyLink ? (
        <Section style={{ textAlign: "center", padding: "20px 0 8px" }}>
          <Button href={calendlyLink} style={s.cta}>Réserver mon entretien</Button>
        </Section>
      ) : null}
      <Text style={s.muted}>
        Si le lien Calendly ne fonctionne pas, réponds directement à cet email et nous organiserons un créneau manuellement.
      </Text>
    </>
  );
}

function StatusReview({ firstName }: { firstName: string }) {
  return (
    <>
      <Text style={s.bodyText}>
        Bonjour{firstName ? ` ${firstName}` : ""}, merci beaucoup pour ta candidature DogShift. Ton profil est intéressant et nous souhaitons prendre le temps de l&apos;examiner en détail avec l&apos;équipe.
      </Text>
      <div style={s.highlight}>
        <Text style={s.highlightText}>
          Nous reviendrons vers toi <strong>sous 5 jours ouvrables</strong>, soit pour organiser un entretien, soit avec un retour motivé.
        </Text>
      </div>
      <Text style={s.muted}>
        Tu peux compléter ta candidature avec des éléments supplémentaires en répondant directement à cet email.
      </Text>
    </>
  );
}

function StatusLow({ firstName }: { firstName: string }) {
  return (
    <>
      <Text style={s.bodyText}>
        Bonjour{firstName ? ` ${firstName}` : ""}, merci beaucoup pour l&apos;intérêt que tu portes à DogShift et pour le temps consacré à ta candidature.
      </Text>
      <Text style={s.bodyText}>
        Nous sommes actuellement en <strong>phase pilote</strong>, avec une sélection très restreinte de dog-sitters. À ce stade, nous ne pourrons malheureusement pas retenir ta candidature.
      </Text>
      <Text style={s.muted}>
        Rien n&apos;est définitif — à mesure que la plateforme grandit, nous rouvrirons les candidatures. Merci encore pour ta confiance&nbsp;!
      </Text>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  body: { margin: 0, padding: 0, backgroundColor: "#f1f5f9", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif" },
  container: { margin: "0 auto", padding: "32px 12px 40px", width: "100%", maxWidth: 600 },

  logoSection: { textAlign: "center", padding: "0 0 24px" },
  brandName: { margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.4px", display: "inline" },

  hero: {
    background: "linear-gradient(135deg,#7c3aed 0%,#6366f1 55%,#818cf8 100%)",
    borderRadius: "16px 16px 0 0",
    padding: "36px 36px 32px",
  },
  heroLabel: {
    display: "inline-block",
    background: "rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    padding: "4px 12px",
    borderRadius: 20,
    marginBottom: 16,
  },
  heroTitle: { margin: "0 0 12px", fontSize: 26, fontWeight: 800, lineHeight: "32px", color: "#ffffff", letterSpacing: "-0.4px" },
  heroSubtitle: { margin: 0, fontSize: 15, lineHeight: "22px", color: "rgba(255,255,255,0.85)" },

  card: { backgroundColor: "#ffffff", borderRadius: "0 0 16px 16px", border: "1px solid #e2e8f0", borderTop: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" },
  cardBody: { padding: "32px 36px 36px" },
  bodyText: { margin: "0 0 12px", fontSize: 14, lineHeight: "22px", color: "#475569" },

  highlight: { marginTop: 16, padding: "12px 16px", backgroundColor: "#f5f3ff", borderRadius: 10, borderLeft: "3px solid #6366f1" },
  highlightText: { margin: 0, fontSize: 13, lineHeight: "19px", color: "#475569" },

  cta: { backgroundColor: "#6366f1", color: "#ffffff", fontSize: 14, fontWeight: 700, textDecoration: "none", padding: "14px 28px", borderRadius: 10, display: "inline-block" },
  muted: { margin: "16px 0 0", fontSize: 12, lineHeight: "18px", color: "#94a3b8" },

  footerSection: { padding: "24px 4px 0", textAlign: "center" },
  socialRow: { display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 },
  socialLink: { textDecoration: "none", display: "inline-block" },
  divider: { height: 1, background: "#e2e8f0", margin: "0 0 12px" },
  footerText: { margin: "0 0 4px", fontSize: 11, lineHeight: "17px", color: "#94a3b8", textAlign: "center" },
  footerLink: { color: "#94a3b8", textDecoration: "none" },
};
