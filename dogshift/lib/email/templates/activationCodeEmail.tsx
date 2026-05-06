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

// ── Social SVGs (footer) ──────────────────────────────────────────────────────
const SVG_INSTAGRAM = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="6" stroke="#94a3b8" stroke-width="1.8"/><circle cx="12" cy="12" r="4" stroke="#94a3b8" stroke-width="1.8"/><circle cx="17.5" cy="6.5" r="1" fill="#94a3b8"/></svg>`;
const SVG_FACEBOOK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_GLOBE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#94a3b8" stroke-width="1.8"/><path d="M12 2c-2.5 3-4 6-4 10s1.5 7 4 10M12 2c2.5 3 4 6 4 10s-1.5 7-4 10M2 12h20" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/></svg>`;

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
  const previewText = (props.previewText || activationCodeEmailDefaultPreviewText()).trim();

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
            <div style={s.heroLabel}>CODE D&apos;ACTIVATION</div>
            <Text style={s.heroTitle}>
              Contrat signé — voici ton code d&apos;activation
            </Text>
            <Text style={s.heroSubtitle}>
              Félicitations{firstName ? ` ${firstName}` : ""}&nbsp;! Ton contrat est signé et ton compte dogsitter est prêt.
            </Text>
          </Section>

          {/* White card */}
          <Section className="ds-card" style={s.card}>
            <div style={s.cardBody}>

              <Text style={s.bodyText}>
                Voici ton <strong>code d&apos;activation personnel</strong> — saisis-le dans ton dashboard pour activer ton profil.
              </Text>

              {/* Code box */}
              <div style={s.codeBox}>
                <span style={s.codeVal}>{activationCode}</span>
              </div>

              <Section style={{ textAlign: "center", padding: "20px 0 8px" }}>
                <Button href={dashboardUrl} style={s.cta}>
                  Activer mon compte dogsitter
                </Button>
              </Section>

              {expiryLabel ? (
                <div style={s.highlight}>
                  <Text style={s.highlightText}>
                    Ce code est valable jusqu&apos;au <strong>{expiryLabel}</strong>. Passée cette date, contacte-nous pour un nouveau code.
                  </Text>
                </div>
              ) : null}

              <Text style={s.muted}>
                Code strictement personnel et à usage unique.
              </Text>
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

  card: {
    backgroundColor: "#ffffff",
    borderRadius: "0 0 16px 16px",
    border: "1px solid #e2e8f0",
    borderTop: "none",
    boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
  },
  cardBody: { padding: "32px 36px 36px" },
  bodyText: { margin: "0 0 20px", fontSize: 14, lineHeight: "22px", color: "#475569" },

  codeBox: {
    margin: "0 0 8px",
    padding: "20px 14px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    textAlign: "center",
  },
  codeVal: {
    fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "4px",
    color: "#6366f1",
  },

  highlight: { marginTop: 16, padding: "12px 16px", backgroundColor: "#f5f3ff", borderRadius: 10, borderLeft: "3px solid #6366f1" },
  highlightText: { margin: 0, fontSize: 13, lineHeight: "19px", color: "#475569" },

  cta: { backgroundColor: "#6366f1", color: "#ffffff", fontSize: 14, fontWeight: 700, textDecoration: "none", padding: "14px 28px", borderRadius: 10, display: "inline-block" },
  muted: { margin: "16px 0 0", fontSize: 12, lineHeight: "18px", color: "#94a3b8", textAlign: "center" },

  footerSection: { padding: "24px 4px 0", textAlign: "center" },
  socialRow: { display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 },
  socialLink: { textDecoration: "none", display: "inline-block" },
  divider: { height: 1, background: "#e2e8f0", margin: "0 0 12px" },
  footerText: { margin: "0 0 4px", fontSize: 11, lineHeight: "17px", color: "#94a3b8", textAlign: "center" },
  footerLink: { color: "#94a3b8", textDecoration: "none" },
};
