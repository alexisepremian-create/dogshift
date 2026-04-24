import {
  Body,
  Button,
  Container,
  Head,
  Hr,
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

const brandBlue = "#2f4d6b";
const brandBlueHover = "#263f58";

// -----------------------------------------------------------------------------
// React Email component
// -----------------------------------------------------------------------------

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
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brandSection}>
            <Img src={logoUrl} width={152} alt="DogShift" style={styles.logo} />
          </Section>

          <Section style={styles.card}>
            {props.status === "HIGH" ? (
              <ApplicationStatusHigh firstName={firstName} calendlyLink={calendlyLink} />
            ) : props.status === "REVIEW" ? (
              <ApplicationStatusReview firstName={firstName} />
            ) : (
              <ApplicationStatusLow firstName={firstName} />
            )}

            <Hr style={styles.hr} />

            <Text style={styles.footerText}>
              Besoin d&apos;aide ?{" "}
              <Link href="mailto:support@dogshift.ch" style={styles.footerLink}>
                support@dogshift.ch
              </Link>
            </Text>
            <Text style={styles.footerText}>
              <Link href={baseUrl || "https://www.dogshift.ch"} style={styles.footerLink}>
                dogshift.ch
              </Link>
            </Text>
          </Section>

          <Text style={styles.bottomMuted}>
            DogShift • Ceci est un email automatique, merci de ne pas répondre.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// -----------------------------------------------------------------------------
// Per-status sub-components (kept in the same file to match the existing
// template convention and avoid cross-file imports for trivial blocks).
// -----------------------------------------------------------------------------

function ApplicationStatusHigh(props: { firstName: string; calendlyLink: string }) {
  return (
    <>
      <Text style={styles.h1}>Félicitations {props.firstName} 🎉</Text>
      <Text style={styles.lead}>
        Bonne nouvelle : ton profil correspond parfaitement à ce que nous cherchons pour la phase
        pilote DogShift.
      </Text>
      <Text style={styles.lead}>
        Pour finaliser ta candidature, nous organisons un court entretien de{" "}
        <strong>15 minutes</strong>. C&apos;est une étape{" "}
        <strong>obligatoire</strong> avant l&apos;activation de ton profil.
      </Text>

      {props.calendlyLink ? (
        <Section style={styles.ctaRow}>
          <Button href={props.calendlyLink} style={styles.cta}>
            Réserver mon entretien
          </Button>
        </Section>
      ) : null}

      <Text style={styles.smallMuted}>
        Choisis simplement le créneau qui t&apos;arrange le mieux — on s&apos;occupe du reste.
      </Text>
    </>
  );
}

function ApplicationStatusReview(props: { firstName: string }) {
  return (
    <>
      <Text style={styles.h1}>Ta candidature est à l&apos;étude 🐾</Text>
      <Text style={styles.lead}>
        Bonjour{props.firstName ? ` ${props.firstName}` : ""}, merci beaucoup pour ta candidature
        DogShift.
      </Text>
      <Text style={styles.lead}>
        Ton profil est intéressant et nous souhaitons prendre le temps de l&apos;examiner en détail
        avec l&apos;équipe avant de te répondre.
      </Text>

      <Section style={styles.highlightBox}>
        <Text style={styles.highlightText}>
          ⏱️ Nous reviendrons vers toi <strong>sous 5 jours ouvrables</strong>, soit pour organiser
          un entretien, soit avec un retour motivé.
        </Text>
      </Section>

      <Text style={styles.smallMuted}>
        Si tu souhaites compléter ta candidature avec des éléments supplémentaires (références,
        expériences, photos), réponds simplement à cet email — on ajoute les infos à ton dossier.
      </Text>
    </>
  );
}

function ApplicationStatusLow(props: { firstName: string }) {
  return (
    <>
      <Text style={styles.h1}>Merci pour ta candidature</Text>
      <Text style={styles.lead}>
        Bonjour{props.firstName ? ` ${props.firstName}` : ""}, merci beaucoup pour l&apos;intérêt
        que tu portes à DogShift et pour le temps que tu as consacré à ta candidature.
      </Text>
      <Text style={styles.lead}>
        Nous sommes actuellement en <strong>phase pilote</strong>, avec une sélection très
        restreinte de dog-sitters pour garantir un service de qualité. À ce stade, nous ne pourrons
        malheureusement pas retenir ta candidature.
      </Text>
      <Text style={styles.lead}>
        Rien n&apos;est définitif : à mesure que la plateforme grandit, nous rouvrirons les
        candidatures. Nous serons ravis de relire ton profil plus tard — n&apos;hésite pas à
        postuler à nouveau.
      </Text>
      <Text style={styles.smallMuted}>Merci encore pour ta confiance et à bientôt, peut-être !</Text>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles — aligned with pilotSitterApplicationConfirmation.tsx
// -----------------------------------------------------------------------------

const styles: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: "#f6f8fb",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji",
    color: "#0f172a",
  },
  container: {
    margin: "0 auto",
    padding: "28px 12px 40px",
    width: "100%",
    maxWidth: 560,
  },
  brandSection: {
    textAlign: "center",
    padding: "0 0 14px",
  },
  logo: {
    margin: "0 auto",
    display: "block",
    height: "auto",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e6edf5",
    borderRadius: 18,
    padding: "22px 22px 18px",
    boxShadow: "0 18px 60px -44px rgba(2, 6, 23, 0.25)",
  },
  h1: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    lineHeight: "28px",
    letterSpacing: "-0.2px",
  },
  lead: {
    margin: "10px 0 0",
    fontSize: 14,
    lineHeight: "20px",
    color: "#334155",
  },
  highlightBox: {
    marginTop: 16,
    padding: "12px 14px",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    border: "1px solid #e6edf5",
  },
  highlightText: {
    margin: 0,
    fontSize: 13,
    lineHeight: "18px",
    color: "#334155",
  },
  ctaRow: {
    textAlign: "center",
    paddingTop: 18,
    paddingBottom: 6,
  },
  cta: {
    backgroundColor: brandBlue,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
    padding: "12px 18px",
    borderRadius: 12,
    display: "inline-block",
    border: `1px solid ${brandBlueHover}`,
  },
  smallMuted: {
    margin: "14px 0 0",
    fontSize: 12,
    lineHeight: "18px",
    color: "#64748b",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #e6edf5",
    margin: "16px 0",
  },
  footerText: {
    margin: "6px 0 0",
    fontSize: 12,
    lineHeight: "18px",
    color: "#475569",
    textAlign: "center",
  },
  footerLink: {
    color: brandBlue,
  },
  bottomMuted: {
    margin: "14px 0 0",
    fontSize: 11,
    lineHeight: "16px",
    color: "#94a3b8",
    textAlign: "center",
  },
};
