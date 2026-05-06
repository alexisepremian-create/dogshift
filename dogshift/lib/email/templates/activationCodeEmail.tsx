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

// ── Social SVGs (footer) ──────────────────────────────────────────────────────

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
      <Head>
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <style type="text/css">{`
    :root { color-scheme: light only !important; }
    :root[data-ogsc] body, :root[data-ogsc] .ds-outer { background-color: #f1f5f9 !important; }
    :root[data-ogsc] .ds-card { background-color: #ffffff !important; }
    :root[data-ogsc] .ds-card td, :root[data-ogsc] .ds-card p,
    :root[data-ogsc] .ds-card div, :root[data-ogsc] .ds-card span { color: #475569 !important; }
    :root[data-ogsc] .ds-card strong, :root[data-ogsc] .ds-card b { color: #0f172a !important; }
    u + .ds-outer .ds-card { background-color: #ffffff !important; }
  `}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body className="ds-outer" style={s.body}>
        <Container style={s.container}>
          {/* Purple hero */}
          <Section style={s.hero}>

          {/* Logo — table layout (flex not supported in Gmail) */}
          <table role="presentation" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", marginBottom: 24 }}>
            <tbody>
              <tr>
                <td align="center" valign="middle" style={{ width: 44, height: 44, backgroundColor: "#ffffff", borderRadius: 22, padding: 2 }}>
                  <Img src={logoUrl} width={40} height={40} alt="" style={{ display: "inline-block", verticalAlign: "middle" }} />
                </td>
                <td style={{ paddingLeft: 10, verticalAlign: "middle" }}>
                  <Link href={baseUrl} style={{ textDecoration: "none" }}>
                    <Text style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.3px" }}>DogShift</Text>
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
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


          {/* ── Closing banner ── */}
          
          {/* ── Closing banner — "Parce qu'il le mérite" ── */}
          <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ borderCollapse: "collapse", margin: "20px 0 0", borderRadius: 16, overflow: "hidden" }}>
            <tbody>
              <tr>
                <td style={{ padding: 0, borderRadius: "16px 16px 0 0", overflow: "hidden", background: "#1e1b4b" }}>
                  <div style={{ position: "relative" as const }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${baseUrl}/email-banners/banner-confiance.jpg`} width="600" alt="" style={{ display: "block", width: "100%", maxWidth: "600px", height: "200px", objectFit: "cover" as const, objectPosition: "center 35%", opacity: 0.45, border: 0 }} />
                    <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ borderCollapse: "collapse", position: "absolute" as const, top: 0, left: 0, height: "200px" }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: "28px 32px", verticalAlign: "middle" }}>
                            <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 13, color: "#c4b5fd", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                              Parce qu&apos;il le mérite.
                            </div>
                            <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 22, fontWeight: 700, lineHeight: "30px", color: "#ffffff", maxWidth: 340 }}>
                              Votre chien mérite<br />quelqu&apos;un de confiance.
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
              <tr>
                <td style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 16px 16px", padding: "24px 32px 28px", textAlign: "center" }}>
                  <a href={`${baseUrl}/sitters`} style={{ display: "inline-block", backgroundColor: "#7c3aed", color: "#ffffff", textDecoration: "none", fontFamily: "Arial,Helvetica,sans-serif", fontSize: 14, fontWeight: 700, lineHeight: "16px", padding: "14px 28px", borderRadius: "12px" }}>
                    Voir les dog-sitters →
                  </a>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <Section style={s.footerSection}>
            <table role="presentation" cellPadding={0} cellSpacing={0} align="center" style={{ borderCollapse: "collapse", margin: "0 auto 20px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "0 10px" }}>
                    <Link href="https://instagram.com/dogshift" style={{ textDecoration: "none", display: "inline-block" }}>
                      <Img src={`${baseUrl}/icons/instagram.png`} width={32} height={32} alt="Instagram" style={{ display: "block", border: 0 }} />
                    </Link>
                  </td>
                  <td style={{ padding: "0 10px" }}>
                    <Link href="https://facebook.com/dogshift" style={{ textDecoration: "none", display: "inline-block" }}>
                      <Img src={`${baseUrl}/icons/facebook.png`} width={32} height={32} alt="Facebook" style={{ display: "block", border: 0 }} />
                    </Link>
                  </td>
                  <td style={{ padding: "0 10px" }}>
                    <Link href={baseUrl} style={{ textDecoration: "none", display: "inline-block" }}>
                      <Img src={`${baseUrl}/icons/globe.png`} width={32} height={32} alt="DogShift" style={{ display: "block", border: 0 }} />
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
            <Hr style={s.divider} />
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
  divider: { borderTop: "1px solid #e2e8f0", margin: "0 0 12px" },
  footerText: { margin: "0 0 4px", fontSize: 11, lineHeight: "17px", color: "#94a3b8", textAlign: "center" },
  footerLink: { color: "#94a3b8", textDecoration: "none" },
};
