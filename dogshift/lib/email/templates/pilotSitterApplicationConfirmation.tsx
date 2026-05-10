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
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={st.body}>
        <Container style={st.container}>

          {/* Logo */}
          <Section style={st.logoSection}>
            <table role="presentation" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "middle" }}>
                    <Img src={logoUrl} width={28} height={28} alt="" style={{ display: "inline-block", verticalAlign: "middle", borderRadius: 6 }} />
                  </td>
                  <td style={{ paddingLeft: 8, verticalAlign: "middle" }}>
                    <span style={{ fontFamily: FF, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>DogShift</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Hr style={st.divider} />

          {/* Content */}
          <Text style={st.greeting}>Bonjour{firstName ? ` ${firstName}` : ""},</Text>
          <Text style={st.text}>
            Nous avons bien reçu ta candidature pour rejoindre DogShift en tant que dog-sitter (phase pilote). Merci de l&apos;intérêt que tu portes à notre plateforme.
          </Text>

          <Text style={st.label}>Prochaines étapes</Text>

          {STEPS.map((step, i) => (
            <table key={i} role="presentation" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", width: "100%", marginBottom: 10 }}>
              <tbody>
                <tr>
                  <td style={{ width: 22, verticalAlign: "top" }}>
                    <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>{i + 1}.</span>
                  </td>
                  <td style={{ fontFamily: FF, fontSize: 14, lineHeight: "21px", color: "#374151" }}>{step}</td>
                </tr>
              </tbody>
            </table>
          ))}

          <Text style={{ ...st.text, marginTop: 16 }}>
            Garde cet email — nous te contacterons directement si une place est disponible pour toi.
          </Text>

          <Section style={st.ctaSection}>
            <Button href={ctaUrl} style={st.cta}>Découvrir DogShift</Button>
          </Section>

          <Text style={st.muted}>
            Des questions&nbsp;? Réponds à cet email ou écris-nous à{" "}
            <Link href="mailto:support@dogshift.ch" style={st.link}>support@dogshift.ch</Link>.
          </Text>

          <Hr style={st.dividerBottom} />

          <Text style={st.footer}>
            <Link href={site} style={st.footerLink}>DogShift</Link>
            {" · "}
            <Link href="mailto:support@dogshift.ch" style={st.footerLink}>support@dogshift.ch</Link>
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

const st: Record<string, CSSProperties> = {
  body: { margin: 0, padding: 0, backgroundColor: "#f8fafc", fontFamily: FF },
  container: { margin: "0 auto", padding: "32px 28px 40px", width: "100%", maxWidth: 540, backgroundColor: "#ffffff" },
  logoSection: { padding: "0 0 20px" },
  divider: { borderTop: "1px solid #e5e7eb", margin: "0 0 28px" },
  dividerBottom: { borderTop: "1px solid #e5e7eb", margin: "28px 0 16px" },
  greeting: { margin: "0 0 12px", fontFamily: FF, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: "#0f172a" },
  text: { margin: "0 0 0", fontFamily: FF, fontSize: 14, lineHeight: "22px", color: "#374151" },
  label: { margin: "20px 0 10px", fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#64748b" },
  ctaSection: { padding: "20px 0 16px" },
  cta: { backgroundColor: "#1e40af", color: "#ffffff", fontFamily: FF, fontSize: 14, fontWeight: 600, textDecoration: "none", padding: "11px 22px", borderRadius: 7, display: "inline-block" },
  muted: { margin: 0, fontFamily: FF, fontSize: 13, lineHeight: "20px", color: "#64748b" },
  link: { color: "#1e40af", textDecoration: "none" },
  footer: { margin: 0, fontFamily: FF, fontSize: 12, lineHeight: "18px", color: "#9ca3af", textAlign: "center" },
  footerLink: { color: "#9ca3af", textDecoration: "none" },
};
