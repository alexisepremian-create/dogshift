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
  activationCodeEmailDefaultPreviewText,
  formatActivationCodeExpiry,
} from "./activationCodeEmailContent";

export {
  activationCodeEmailSubject,
  activationCodeEmailPlainText,
  formatActivationCodeExpiry,
} from "./activationCodeEmailContent";
export type { ActivationCodeEmailParams } from "./activationCodeEmailContent";

const ACCENT = "#2f4d6b";

// Inline SVG icons — no emojis
const ICON_CLOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="9" stroke="#64748b" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="#64748b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_LOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;margin-right:4px;"><rect x="5" y="11" width="14" height="10" rx="2" stroke="#64748b" stroke-width="1.8"/><path d="M8 11V7a4 4 0 018 0v4" stroke="#64748b" stroke-width="1.8" stroke-linecap="round"/></svg>`;

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

            {/* Accent top bar */}
            <div style={s.accentBar} />

            <div style={s.cardBody}>
              <Text className="ds-title" style={s.h1}>
                Contrat signé — voici ton code d&apos;activation
              </Text>
              <Text className="ds-lead" style={s.lead}>
                Félicitations {firstName ? `${firstName}\u00A0!` : "!"} Ton contrat est signé et ton compte dogsitter est prêt à être activé.
              </Text>
              <Text className="ds-lead" style={s.lead}>
                Voici ton <strong>code d&apos;activation personnel</strong> :
              </Text>

              {/* Code box */}
              <Section className="ds-code-box" style={s.codeBox}>
                <Text className="ds-code-val" style={s.codeVal}>{activationCode}</Text>
              </Section>

              <Text className="ds-lead" style={s.lead}>
                Connecte-toi à ton dashboard et saisis ce code pour activer ton profil.
              </Text>

              <Section style={s.ctaRow}>
                <Button href={dashboardUrl} style={s.cta}>
                  Activer mon compte dogsitter
                </Button>
              </Section>

              {expiryLabel ? (
                <Section className="ds-highlight" style={s.highlight}>
                  <Text className="ds-highlight-text" style={s.highlightText}>
                    <span
                      dangerouslySetInnerHTML={{ __html: ICON_CLOCK }}
                    />
                    {" "}
                    Ce code est valable jusqu&apos;au{" "}
                    <strong>{expiryLabel}</strong>. Passée cette date, contacte-nous pour un nouveau code.
                  </Text>
                </Section>
              ) : null}

              <Text className="ds-muted" style={s.muted}>
                <span dangerouslySetInnerHTML={{ __html: ICON_LOCK }} />
                {" "}
                Code strictement personnel et à usage unique.
              </Text>
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
            DogShift · Plateforme de dogsitting premium en Suisse · Ceci est un email automatique.
          </Text>
        </Container>
      </Body>
    </Html>
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
  logoSection: {
    textAlign: "center",
    padding: "0 0 20px",
  },
  logoLink: {
    display: "inline-block",
  },
  logo: {
    display: "block",
    margin: "0 auto",
    height: "auto",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)",
  },
  accentBar: {
    height: 4,
    backgroundColor: ACCENT,
    fontSize: 0,
    lineHeight: "0",
  },
  cardBody: {
    padding: "32px 36px 36px",
  },
  h1: {
    margin: "0 0 8px",
    fontSize: 22,
    fontWeight: 800,
    lineHeight: "28px",
    letterSpacing: "-0.3px",
    color: "#0f172a",
  },
  lead: {
    margin: "12px 0 0",
    fontSize: 14,
    lineHeight: "22px",
    color: "#475569",
  },
  codeBox: {
    margin: "20px 0 8px",
    padding: "20px 14px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    textAlign: "center",
  },
  codeVal: {
    margin: 0,
    fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: "3px",
    color: ACCENT,
  },
  highlight: {
    marginTop: 16,
    padding: "12px 16px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    borderLeft: `3px solid ${ACCENT}`,
  },
  highlightText: {
    margin: 0,
    fontSize: 13,
    lineHeight: "19px",
    color: "#475569",
  },
  ctaRow: {
    textAlign: "center",
    padding: "20px 0 8px",
  },
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
  muted: {
    margin: "16px 0 0",
    fontSize: 12,
    lineHeight: "18px",
    color: "#94a3b8",
  },
  footerText: {
    margin: "20px 0 0",
    fontSize: 12,
    lineHeight: "18px",
    color: "#94a3b8",
    textAlign: "center",
  },
  footerLink: {
    color: "#64748b",
    textDecoration: "none",
  },
  bottomMuted: {
    margin: "8px 0 0",
    fontSize: 11,
    lineHeight: "16px",
    color: "#cbd5e1",
    textAlign: "center",
  },
};
