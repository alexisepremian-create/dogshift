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
  activationCodeEmailDefaultPreviewText,
  formatActivationCodeExpiry,
} from "./activationCodeEmailContent";

export {
  activationCodeEmailSubject,
  activationCodeEmailPlainText,
  formatActivationCodeExpiry,
} from "./activationCodeEmailContent";
export type { ActivationCodeEmailParams } from "./activationCodeEmailContent";

const brandBlue = "#2f4d6b";
const brandBlueHover = "#263f58";

// -----------------------------------------------------------------------------
// React Email component
// Shares the layout conventions of applicationStatusEmail.tsx:
// - DogShift logo on top
// - White card with the body
// - Same footer (support link + domain)
// - Same colour palette + spacing
// -----------------------------------------------------------------------------

export function ActivationCodeEmail(props: {
  baseUrl?: string;
  firstName: string;
  activationCode: string;
  expiresAt?: Date | string | null;
  previewText?: string;
}) {
  const baseUrl = (props.baseUrl || "https://www.dogshift.ch").trim().replace(/\/$/, "");
  const logoUrl = `${baseUrl}/dogshift-logo.png`;
  const firstName = (props.firstName || "").trim();
  const activationCode = (props.activationCode || "").trim();
  const dashboardUrl = `${baseUrl}/become-sitter/access?code=${encodeURIComponent(activationCode)}`;
  const expiryLabel = formatActivationCodeExpiry(props.expiresAt);
  const previewText = (
    props.previewText || activationCodeEmailDefaultPreviewText()
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
            <Text style={styles.h1}>
              Félicitations {firstName || "et bienvenue"} 🎉
            </Text>
            <Text style={styles.lead}>
              Ton contrat est signé et ton compte dogsitter est prêt à être activé.
            </Text>
            <Text style={styles.lead}>
              Voici ton <strong>code d&apos;activation personnel</strong> :
            </Text>

            <Section style={styles.codeBox}>
              <Text style={styles.codeValue}>{activationCode}</Text>
            </Section>

            <Text style={styles.lead}>
              Connecte-toi à ton dashboard et saisis ce code pour activer ton profil.
            </Text>

            <Section style={styles.ctaRow}>
              <Button href={dashboardUrl} style={styles.cta}>
                Activer mon compte dogsitter
              </Button>
            </Section>

            {expiryLabel ? (
              <Section style={styles.highlightBox}>
                <Text style={styles.highlightText}>
                  ⏱️ Ce code est valable jusqu&apos;au{" "}
                  <strong>{expiryLabel}</strong>. Passée cette date, demande-nous un
                  nouveau code.
                </Text>
              </Section>
            ) : null}

            <Text style={styles.smallMuted}>
              Le code est strictement personnel et à usage unique.
            </Text>

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
// Styles — aligned with applicationStatusEmail.tsx
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
  codeBox: {
    margin: "16px 0 6px",
    padding: "18px 14px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e6edf5",
    borderRadius: 14,
    textAlign: "center",
  },
  codeValue: {
    margin: 0,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace",
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: "2px",
    color: brandBlue,
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
