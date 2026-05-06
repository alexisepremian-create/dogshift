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

const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";


const STEPS = [
  "Analyse de ton profil — sélection manuelle par notre équipe",
  "On te recontacte si ton profil est retenu pour la phase pilote",
  "Entretien de 15 min, puis activation de ton profil",
];

export function pilotSitterApplicationConfirmationPlainText(params: {
  firstName: string;
  ctaUrl: string;
}) {
  const firstName = (params.firstName || "").trim();
  const ctaUrl = (params.ctaUrl || "").trim();
  return (
    `Bonjour${firstName ? ` ${firstName}` : ""},\n\n` +
    `Nous avons bien reçu ta candidature pour devenir dog-sitter DogShift (phase pilote).\n\n` +
    `Prochaines étapes :\n1) Analyse de ton profil.\n2) On te recontacte si retenu.\n3) Entretien puis activation.\n\n` +
    (ctaUrl ? `Découvrir DogShift : ${ctaUrl}\n\n` : "") +
    `Besoin d'aide ? support@dogshift.ch\n\n— DogShift\n`
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
  const firstName = (props.firstName || "").trim();
  const site = baseUrl || "https://dogshift.ch";

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

          {/* ── Purple hero ── */}
          <Section style={s.hero}>

            {/* Logo — table layout (flex not supported in Gmail) */}
            <table role="presentation" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", marginBottom: 24 }}>
              <tbody>
                <tr>
                  <td align="center" valign="middle" style={{ width: 44, height: 44, backgroundColor: "#ffffff", borderRadius: 22, padding: 7 }}>
                    <Img src={logoUrl} width={30} height={30} alt="" style={{ display: "inline-block", verticalAlign: "middle" }} />
                  </td>
                  <td style={{ paddingLeft: 10, verticalAlign: "middle" }}>
                    <Link href={site} style={{ textDecoration: "none" }}>
                      <Text style={{ margin: 0, fontFamily: FF, fontSize: 17, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.3px" }}>DogShift</Text>
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Badge */}
            <div style={s.heroLabel}>CANDIDATURE REÇUE</div>

            <Text style={s.heroTitle}>
              Merci{firstName ? ` ${firstName}` : ""}, ta candidature est bien enregistrée.
            </Text>
            <Text style={s.heroSubtitle}>
              Nous avons bien reçu tes informations pour rejoindre DogShift en tant que dog-sitter (phase pilote).
            </Text>
          </Section>

          {/* ── White content card ── */}
          <Section className="ds-card" style={s.card}>
            <div style={s.cardBody}>

              <Text style={s.stepsTitle}>Prochaines étapes</Text>

              {/* Steps — table layout (flex not supported) */}
              {STEPS.map((step, i) => (
                <table key={i} role="presentation" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", width: "100%", marginBottom: 12 }}>
                  <tbody>
                    <tr>
                      <td style={{ width: 28, paddingRight: 10, verticalAlign: "top" }}>
                        <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#ede9fe", fontFamily: FF, fontSize: 12, fontWeight: 700, textAlign: "center", lineHeight: "24px", color: "#7c3aed" }}>{i + 1}</div>
                      </td>
                      <td style={{ verticalAlign: "middle", fontFamily: FF, fontSize: 14, lineHeight: "22px", color: "#475569" }}>
                        {step}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ))}

              <Section style={{ textAlign: "center", padding: "16px 0 8px" }}>
                <Button href={ctaUrl} style={s.cta}>Découvrir DogShift</Button>
              </Section>
              <Text style={s.muted}>Garde cet email — on te contactera directement si une place est disponible.</Text>
            </div>
          </Section>


          {/* ── Closing banner ── */}
          <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ borderCollapse: "collapse", margin: "20px 0 0", borderRadius: 16, overflow: "hidden", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
            <tbody>
              <tr>
                <td style={{ padding: 0, lineHeight: "0px", fontSize: "0px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${site}/email-banners/banner-hero.jpg`} width="600" alt="" style={{ display: "block", width: "100%", maxWidth: "600px", border: 0, borderRadius: "16px 16px 0 0" }} />
                </td>
              </tr>
              <tr>
                <td style={{ backgroundColor: "#ffffff", padding: "22px 36px 28px", textAlign: "center", borderRadius: "0 0 16px 16px" }}>
                  <p style={{ margin: "0 0 14px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Découvrez les meilleurs dog-sitters DogShift</p>
                  <a href={`${site}/sitters`} style={{ backgroundColor: "#6366f1", color: "#ffffff", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif", fontSize: 14, fontWeight: 700, textDecoration: "none", padding: "13px 28px", borderRadius: 10, display: "inline-block" }}>Voir les dog-sitters →</a>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Footer ── */}
          <Section style={s.footerSection}>
            <table role="presentation" cellPadding={0} cellSpacing={0} align="center" style={{ borderCollapse: "collapse", margin: "0 auto 20px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "0 10px" }}>
                    <Link href="https://instagram.com/dogshift" style={{ textDecoration: "none", display: "inline-block" }}>
                      <Img src={`${site}/icons/instagram.png`} width={32} height={32} alt="Instagram" style={{ display: "block", border: 0 }} />
                    </Link>
                  </td>
                  <td style={{ padding: "0 10px" }}>
                    <Link href="https://facebook.com/dogshift" style={{ textDecoration: "none", display: "inline-block" }}>
                      <Img src={`${site}/icons/facebook.png`} width={32} height={32} alt="Facebook" style={{ display: "block", border: 0 }} />
                    </Link>
                  </td>
                  <td style={{ padding: "0 10px" }}>
                    <Link href={site} style={{ textDecoration: "none", display: "inline-block" }}>
                      <Img src={`${site}/icons/globe.png`} width={32} height={32} alt="DogShift" style={{ display: "block", border: 0 }} />
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
            <Hr style={s.divider} />
            <Text style={s.footerText}>DogShift &middot; support@dogshift.ch &middot; Plateforme de dogsitting premium en Suisse</Text>
            <Text style={s.footerText}>
              <Link href={site} style={s.footerLink}>dogshift.ch</Link>
              &nbsp;&middot;&nbsp;
              <Link href="mailto:support@dogshift.ch" style={s.footerLink}>support@dogshift.ch</Link>
              &nbsp;&middot;&nbsp;
              <Link href={`${site}/unsubscribe`} style={{ ...s.footerLink, textDecoration: "underline" }}>Se désabonner</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

export function pilotSitterApplicationConfirmationCtaUrl(baseUrl: string) {
  const b = (baseUrl || "").trim().replace(/\/$/, "");
  return b ? `${b}/devenir-dogsitter` : "https://dogshift.ch/devenir-dogsitter";
}

const s: Record<string, CSSProperties> = {
  body: { margin: 0, padding: 0, backgroundColor: "#f1f5f9", fontFamily: FF },
  container: { margin: "0 auto", padding: "32px 12px 40px", width: "100%", maxWidth: 600 },

  hero: { background: "linear-gradient(135deg,#7c3aed 0%,#6366f1 55%,#818cf8 100%)", borderRadius: "16px 16px 0 0", padding: "28px 36px 32px" },
  heroLabel: { display: "inline-block", background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.95)", fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, padding: "4px 12px", borderRadius: 20, marginBottom: 16 },
  heroTitle: { margin: "0 0 12px", fontFamily: FF, fontSize: 26, fontWeight: 800, lineHeight: "32px", color: "#ffffff", letterSpacing: "-0.4px" },
  heroSubtitle: { margin: 0, fontFamily: FF, fontSize: 15, lineHeight: "22px", color: "rgba(255,255,255,0.85)" },

  card: { backgroundColor: "#ffffff", borderRadius: "0 0 16px 16px", border: "1px solid #e2e8f0", borderTop: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" },
  cardBody: { padding: "32px 36px 36px" },
  stepsTitle: { margin: "0 0 16px", fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#64748b" },

  cta: { backgroundColor: "#6366f1", color: "#ffffff", fontFamily: FF, fontSize: 14, fontWeight: 700, textDecoration: "none", padding: "14px 28px", borderRadius: 10, display: "inline-block" },
  muted: { margin: "16px 0 0", fontFamily: FF, fontSize: 12, lineHeight: "18px", color: "#94a3b8", textAlign: "center" },

  footerSection: { padding: "24px 4px 0", textAlign: "center" },
  divider: { borderTop: "1px solid #e2e8f0", margin: "0 0 12px" },
  footerText: { margin: "0 0 4px", fontFamily: FF, fontSize: 11, lineHeight: "17px", color: "#94a3b8", textAlign: "center" },
  footerLink: { color: "#94a3b8", textDecoration: "none" },
};
