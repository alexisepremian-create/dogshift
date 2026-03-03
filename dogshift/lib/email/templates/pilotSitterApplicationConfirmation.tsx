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

const brandBlue = "#2f4d6b";
const brandBlueHover = "#263f58";

export function pilotSitterApplicationConfirmationPlainText(params: { firstName: string; ctaUrl: string }) {
  const firstName = (params.firstName || "").trim() || "";
  const ctaUrl = (params.ctaUrl || "").trim();

  return (
    `Bonjour${firstName ? ` ${firstName}` : ""},\n\n` +
    `Nous avons bien reçu ta candidature pour devenir dog-sitter DogShift (phase pilote).\n\n` +
    `Prochaines étapes :\n` +
    `1) On analyse ton profil (sélection manuelle).\n` +
    `2) On te recontacte si ton profil est retenu.\n` +
    `3) Mini entretien, puis validation et activation du profil.\n\n` +
    (ctaUrl ? `Découvrir DogShift : ${ctaUrl}\n\n` : "") +
    `Besoin d’aide ? support@dogshift.ch\n\n` +
    `— DogShift\n`
  );
}

export function PilotSitterApplicationConfirmationEmail(props: {
  baseUrl: string;
  firstName: string;
  previewText?: string;
}) {
  const baseUrl = (props.baseUrl || "").trim().replace(/\/$/, "");
  const logoUrl = baseUrl ? `${baseUrl}/dogshift-logo.png` : "";
  const ctaUrl = baseUrl ? `${baseUrl}/devenir-dogsitter` : "https://dogshift.ch/devenir-dogsitter";
  const previewText = (props.previewText || "Candidature reçue — DogShift").trim();

  return (
    <Html lang="fr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brandSection}>
            {logoUrl ? (
              <Img src={logoUrl} width={152} alt="DogShift" style={styles.logo} />
            ) : (
              <Text style={styles.brandFallback}>DogShift</Text>
            )}
          </Section>

          <Section style={styles.card}>
            <Text style={styles.h1}>Candidature reçue ✅</Text>
            <Text style={styles.lead}>
              Bonjour{props.firstName?.trim() ? ` ${props.firstName.trim()}` : ""}, merci pour ta candidature. On a bien
              reçu tes informations.
            </Text>

            <Section style={styles.steps}>
              <Text style={styles.h2}>Prochaines étapes</Text>
              <Text style={styles.stepItem}>
                <strong>1)</strong> Analyse de ton profil (sélection manuelle)
              </Text>
              <Text style={styles.stepItem}>
                <strong>2)</strong> On te recontacte si ton profil est retenu
              </Text>
              <Text style={styles.stepItem}>
                <strong>3)</strong> Mini entretien, puis validation et activation du profil
              </Text>
            </Section>

            <Section style={styles.ctaRow}>
              <Button href={ctaUrl} style={styles.cta}>
                Découvrir DogShift
              </Button>
            </Section>

            <Text style={styles.smallMuted}>
              Tu peux garder ce mail — on te contactera si une place se libère sur la phase pilote.
            </Text>

            <Hr style={styles.hr} />

            <Text style={styles.footerText}>
              Besoin d’aide ? <Link href="mailto:support@dogshift.ch">support@dogshift.ch</Link>
            </Text>
            <Text style={styles.footerText}>
              <Link href={baseUrl || "https://dogshift.ch"}>dogshift.ch</Link>
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

export function pilotSitterApplicationConfirmationCtaUrl(baseUrl: string) {
  const b = (baseUrl || "").trim().replace(/\/$/, "");
  return b ? `${b}/devenir-dogsitter` : "https://dogshift.ch/devenir-dogsitter";
}

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
  brandFallback: {
    margin: 0,
    fontWeight: 800,
    fontSize: 18,
    letterSpacing: "0.2px",
    color: "#0f172a",
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
  steps: {
    marginTop: 16,
    padding: "14px 14px 6px",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    border: "1px solid #e6edf5",
  },
  h2: {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
    lineHeight: "20px",
    color: "#0f172a",
  },
  stepItem: {
    margin: "10px 0",
    fontSize: 13,
    lineHeight: "18px",
    color: "#334155",
  },
  ctaRow: {
    textAlign: "center",
    paddingTop: 14,
  },
  cta: {
    backgroundColor: brandBlue,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
    padding: "12px 16px",
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
  bottomMuted: {
    margin: "14px 0 0",
    fontSize: 11,
    lineHeight: "16px",
    color: "#94a3b8",
    textAlign: "center",
  },
};
