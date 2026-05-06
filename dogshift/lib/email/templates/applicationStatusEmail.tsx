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

const ACCENT = "#2f4d6b";

const DARK_CSS = `
@media (prefers-color-scheme: dark) {
  body, .ds-outer { background-color: #0f172a !important; }
  .ds-card { background-color: #1e293b !important; border-color: #334155 !important; }
  .ds-title { color: #f1f5f9 !important; }
  .ds-lead { color: #94a3b8 !important; }
  .ds-highlight { background-color: #0f172a !important; border-color: #334155 !important; }
  .ds-highlight-text { color: #94a3b8 !important; }
  .ds-footer-text { color: #475569 !important; }
  .ds-footer-link { color: #64748b !important; }
  .ds-muted { color: #475569 !important; }
  .ds-bottom { color: #334155 !important; }
  .ds-badge-green { background-color: #14532d !important; color: #86efac !important; }
  .ds-badge-amber { background-color: #422006 !important; color: #fde68a !important; }
}`;

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
  const previewText = (
    props.previewText || applicationStatusEmailDefaultPreviewText(props.status)
  ).trim();

  return (
    <Html lang="fr">
      <Head>
        <style>{DARK_CSS}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body className="ds-outer" style={s.body}>
        <Container style={s.container}>

          {/* Logo */}
          <Section style={s.logoSection}>
            <Link href={baseUrl} style={s.logoLink}>
              <Img src={logoUrl} width={140} alt="DogShift" style={s.logo} />
            </Link>
          </Section>

          {/* Main card */}
          <Section className="ds-card" style={s.card}>
            <div style={s.accentBar} />
            <div style={s.cardBody}>
              {props.status === "HIGH" ? (
                <ApplicationStatusHigh firstName={firstName} calendlyLink={calendlyLink} />
              ) : props.status === "REVIEW" ? (
                <ApplicationStatusReview firstName={firstName} />
              ) : (
                <ApplicationStatusLow firstName={firstName} />
              )}
            </div>
          </Section>

          {/* Footer */}
          <Text className="ds-footer-text" style={s.footerText}>
            Besoin d&apos;aide ?{" "}
            <Link href="mailto:support@dogshift.ch" className="ds-footer-link" style={s.footerLink}>
              support@dogshift.ch
            </Link>
            {" "}·{" "}
            <Link href={baseUrl} className="ds-footer-link" style={s.footerLink}>
              dogshift.ch
            </Link>
          </Text>
          <Text className="ds-bottom" style={s.bottomMuted}>
            DogShift · Plateforme de dogsitting premium en Suisse · Email automatique.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ── Per-status sub-components ─────────────────────────────────────────────────

function ApplicationStatusHigh(props: { firstName: string; calendlyLink: string }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span
          className="ds-badge-green"
          style={{
            display: "inline-block",
            background: "#dcfce7",
            color: "#15803d",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          Profil retenu
        </span>
      </div>
      <Text className="ds-title" style={s.h1}>
        Félicitations {props.firstName ? `${props.firstName} !` : "!"}
      </Text>
      <Text className="ds-lead" style={s.lead}>
        Bonne nouvelle : ton profil correspond parfaitement à ce que nous cherchons pour la phase pilote DogShift.
      </Text>
      <Text className="ds-lead" style={s.lead}>
        Pour finaliser ta candidature, nous organisons un court entretien de{" "}
        <strong>15 minutes</strong>. C&apos;est une étape{" "}
        <strong>obligatoire</strong> avant l&apos;activation de ton profil.
      </Text>

      {props.calendlyLink ? (
        <Section style={s.ctaRow}>
          <Button href={props.calendlyLink} style={s.cta}>
            Réserver mon entretien
          </Button>
        </Section>
      ) : null}

      <Text className="ds-muted" style={s.muted}>
        Si le lien Calendly ne fonctionne pas, réponds directement à cet email et nous organiserons
        un créneau avec toi manuellement.
      </Text>
    </>
  );
}

function ApplicationStatusReview(props: { firstName: string }) {
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <span
          className="ds-badge-amber"
          style={{
            display: "inline-block",
            background: "#fef9c3",
            color: "#a16207",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          En cours d&apos;examen
        </span>
      </div>
      <Text className="ds-title" style={s.h1}>
        Ta candidature est à l&apos;étude
      </Text>
      <Text className="ds-lead" style={s.lead}>
        Bonjour{props.firstName ? ` ${props.firstName}` : ""}, merci beaucoup pour ta candidature DogShift.
      </Text>
      <Text className="ds-lead" style={s.lead}>
        Ton profil est intéressant et nous souhaitons prendre le temps de l&apos;examiner en détail avec l&apos;équipe avant de te répondre.
      </Text>

      <Section className="ds-highlight" style={s.highlight}>
        <Text className="ds-highlight-text" style={s.highlightText}>
          Nous reviendrons vers toi <strong>sous 5 jours ouvrables</strong>, soit pour organiser
          un entretien, soit avec un retour motivé.
        </Text>
      </Section>

      <Text className="ds-muted" style={s.muted}>
        Tu peux compléter ta candidature avec des éléments supplémentaires (références, expériences, photos) en répondant directement à cet email.
      </Text>
    </>
  );
}

function ApplicationStatusLow(props: { firstName: string }) {
  return (
    <>
      <Text className="ds-title" style={s.h1}>Merci pour ta candidature</Text>
      <Text className="ds-lead" style={s.lead}>
        Bonjour{props.firstName ? ` ${props.firstName}` : ""}, merci beaucoup pour l&apos;intérêt que tu portes à DogShift et pour le temps consacré à ta candidature.
      </Text>
      <Text className="ds-lead" style={s.lead}>
        Nous sommes actuellement en <strong>phase pilote</strong>, avec une sélection très restreinte de dog-sitters pour garantir un service de qualité. À ce stade, nous ne pourrons malheureusement pas retenir ta candidature.
      </Text>
      <Text className="ds-lead" style={s.lead}>
        Rien n&apos;est définitif : à mesure que la plateforme grandit, nous rouvrirons les candidatures — n&apos;hésite pas à postuler à nouveau.
      </Text>
      <Text className="ds-muted" style={s.muted}>Merci encore pour ta confiance et à bientôt, peut-être !</Text>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: "#f1f5f9",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif",
    color: "#0f172a",
  },
  container: {
    margin: "0 auto",
    padding: "32px 12px 40px",
    width: "100%",
    maxWidth: 600,
  },
  logoSection: { textAlign: "center", padding: "0 0 20px" },
  logoLink: { display: "inline-block" },
  logo: { display: "block", margin: "0 auto", height: "auto" },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)",
  },
  accentBar: { height: 4, backgroundColor: ACCENT, fontSize: 0, lineHeight: "0" },
  cardBody: { padding: "32px 36px 36px" },
  h1: {
    margin: "0 0 8px",
    fontSize: 22,
    fontWeight: 800,
    lineHeight: "28px",
    letterSpacing: "-0.3px",
    color: "#0f172a",
  },
  lead: { margin: "12px 0 0", fontSize: 14, lineHeight: "22px", color: "#475569" },
  highlight: {
    marginTop: 16,
    padding: "12px 16px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    borderLeft: `3px solid ${ACCENT}`,
  },
  highlightText: { margin: 0, fontSize: 13, lineHeight: "19px", color: "#475569" },
  ctaRow: { textAlign: "center", padding: "20px 0 8px" },
  cta: {
    backgroundColor: ACCENT,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    padding: "14px 28px",
    borderRadius: 10,
    display: "inline-block",
  },
  muted: { margin: "16px 0 0", fontSize: 12, lineHeight: "18px", color: "#94a3b8" },
  footerText: {
    margin: "20px 0 0",
    fontSize: 12,
    lineHeight: "18px",
    color: "#94a3b8",
    textAlign: "center",
  },
  footerLink: { color: "#64748b", textDecoration: "none" },
  bottomMuted: { margin: "8px 0 0", fontSize: 11, lineHeight: "16px", color: "#cbd5e1", textAlign: "center" },
};
