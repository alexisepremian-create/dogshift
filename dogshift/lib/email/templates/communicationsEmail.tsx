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

// ── Social SVGs (footer) ──────────────────────────────────────────────────────

export function CommunicationsEmail(props: {
  baseUrl: string;
  firstName: string;
  subject: string;
  customMessage?: string;
  previewText?: string;
}) {
  const baseUrl = (props.baseUrl || "https://www.dogshift.ch").trim().replace(/\/$/, "");
  const logoUrl = `${baseUrl}/dogshift-logo.png`;
  const previewText = (props.previewText || props.subject || "Message de DogShift").trim();
  const firstName = (props.firstName || "").trim();

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
                <td align="center" valign="middle" style={{ width: 44, height: 44, backgroundColor: "#ffffff", borderRadius: 22, padding: 7 }}>
                  <Img src={logoUrl} width={30} height={30} alt="" style={{ display: "inline-block", verticalAlign: "middle" }} />
                </td>
                <td style={{ paddingLeft: 10, verticalAlign: "middle" }}>
                  <Link href={baseUrl} style={{ textDecoration: "none" }}>
                    <Text style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.3px" }}>DogShift</Text>
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
          <div style={s.heroLabel}>MESSAGE DOGSHIFT</div>
            <Text style={s.heroTitle}>{props.subject}</Text>
            {firstName ? <Text style={s.heroSubtitle}>Bonjour {firstName},</Text> : null}
          </Section>

          {/* White card */}
          <Section className="ds-card" style={s.card}>
            <div style={s.cardBody}>

              {props.customMessage ? (
                <div style={s.messageBox}>
                  {props.customMessage.split("\n").map((line, i) =>
                    line.trim() === "" ? (
                      <Text key={i} style={s.messageSpacer}>{" "}</Text>
                    ) : (
                      <Text key={i} style={s.messageText}>{line}</Text>
                    ),
                  )}
                </div>
              ) : null}

              <Section style={{ textAlign: "center", padding: "20px 0 8px" }}>
                <Button href={baseUrl} style={s.cta}>
                  Visiter DogShift
                </Button>
              </Section>
            </div>
          </Section>


          {/* ── Closing banner ── */}
          <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ borderCollapse: "collapse", margin: "20px 0 0", borderRadius: 16, overflow: "hidden", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
            <tbody>
              <tr>
                <td style={{ padding: 0, lineHeight: "0px", fontSize: "0px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${baseUrl}/email-banners/banner-hero.jpg`} width="600" alt="" style={{ display: "block", width: "100%", maxWidth: "600px", border: 0, borderRadius: "16px 16px 0 0" }} />
                </td>
              </tr>
              <tr>
                <td style={{ backgroundColor: "#ffffff", padding: "22px 36px 28px", textAlign: "center", borderRadius: "0 0 16px 16px" }}>
                  <p style={{ margin: "0 0 14px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Trouvez le dog-sitter parfait pour votre chien</p>
                  <a href={`${baseUrl}/sitters`} style={{ backgroundColor: "#6366f1", color: "#ffffff", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif", fontSize: 14, fontWeight: 700, textDecoration: "none", padding: "13px 28px", borderRadius: 10, display: "inline-block" }}>Voir les dog-sitters →</a>
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

export function communicationsEmailPlainText(params: {
  firstName: string;
  subject: string;
  customMessage?: string;
  baseUrl?: string;
}) {
  const base = (params.baseUrl || "https://www.dogshift.ch").trim().replace(/\/$/, "");
  return [
    `Bonjour${params.firstName ? ` ${params.firstName}` : ""},`,
    "",
    params.subject,
    "",
    ...(params.customMessage ? [params.customMessage, ""] : []),
    `Visiter DogShift : ${base}`,
    "",
    "— L'équipe DogShift",
    "support@dogshift.ch",
  ].join("\n");
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

  messageBox: { padding: "16px 18px", backgroundColor: "#f5f3ff", borderRadius: 10, borderLeft: "3px solid #6366f1" },
  messageText: { margin: "2px 0", fontSize: 14, lineHeight: "22px", color: "#334155" },
  messageSpacer: { margin: 0, fontSize: 6, lineHeight: "6px", color: "transparent" },

  cta: { backgroundColor: "#6366f1", color: "#ffffff", fontSize: 14, fontWeight: 700, textDecoration: "none", padding: "14px 28px", borderRadius: 10, display: "inline-block" },

  footerSection: { padding: "24px 4px 0", textAlign: "center" },
  divider: { borderTop: "1px solid #e2e8f0", margin: "0 0 12px" },
  footerText: { margin: "0 0 4px", fontSize: 11, lineHeight: "17px", color: "#94a3b8", textAlign: "center" },
  footerLink: { color: "#94a3b8", textDecoration: "none" },
};
