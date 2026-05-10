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

const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";

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
  const previewText = (props.previewText || applicationStatusEmailDefaultPreviewText(props.status)).trim();

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

          {/* Per-status content */}
          {props.status === "HIGH" ? (
            <StatusHigh firstName={firstName} calendlyLink={calendlyLink} />
          ) : props.status === "REVIEW" ? (
            <StatusReview firstName={firstName} />
          ) : (
            <StatusLow firstName={firstName} />
          )}

          <Hr style={st.dividerBottom} />

          <Text style={st.footer}>
            <Link href={baseUrl} style={st.footerLink}>DogShift</Link>
            {" · "}
            <Link href="mailto:support@dogshift.ch" style={st.footerLink}>support@dogshift.ch</Link>
          </Text>

        </Container>
      </Body>
    </Html>
  );
}

// ── Per-status body content ───────────────────────────────────────────────────

function StatusHigh({ firstName, calendlyLink }: { firstName: string; calendlyLink: string }) {
  return (
    <>
      <Text style={st.greeting}>Bonjour{firstName ? ` ${firstName}` : ""},</Text>
      <Text style={st.text}>
        Bonne nouvelle&nbsp;! Ton profil correspond à ce que nous cherchons pour la phase pilote DogShift. Pour finaliser ta candidature, nous organisons un court entretien de{" "}
        <strong>15 minutes</strong> — c&apos;est une étape <strong>obligatoire</strong>{" "}avant l&apos;activation de ton profil.
      </Text>
      {calendlyLink ? (
        <>
          <Section style={st.ctaSection}>
            <Button href={calendlyLink} style={st.cta}>Réserver mon entretien</Button>
          </Section>
          <Text style={st.muted}>
            Si le lien ne fonctionne pas, réponds directement à cet email et nous organiserons un créneau manuellement.
          </Text>
        </>
      ) : (
        <Text style={st.muted}>
          Réponds directement à cet email pour convenir d&apos;un créneau avec l&apos;équipe.
        </Text>
      )}
      <Text style={{ ...st.muted, marginTop: 16 }}>
        Des questions&nbsp;? Écris-nous à{" "}
        <Link href="mailto:support@dogshift.ch" style={st.link}>support@dogshift.ch</Link>.
      </Text>
    </>
  );
}

function StatusReview({ firstName }: { firstName: string }) {
  return (
    <>
      <Text style={st.greeting}>Bonjour{firstName ? ` ${firstName}` : ""},</Text>
      <Text style={st.text}>
        Merci beaucoup pour ta candidature DogShift. Ton profil est intéressant et nous souhaitons prendre le temps de l&apos;examiner en détail avec l&apos;équipe.
      </Text>
      <Text style={st.text}>
        Nous reviendrons vers toi <strong>sous 5 jours ouvrables</strong>, soit pour organiser un entretien, soit avec un retour motivé.
      </Text>
      <Text style={st.muted}>
        Tu peux compléter ta candidature avec des éléments supplémentaires en répondant directement à cet email.
      </Text>
    </>
  );
}

function StatusLow({ firstName }: { firstName: string }) {
  return (
    <>
      <Text style={st.greeting}>Bonjour{firstName ? ` ${firstName}` : ""},</Text>
      <Text style={st.text}>
        Merci pour l&apos;intérêt que tu portes à DogShift et pour le temps consacré à ta candidature.
      </Text>
      <Text style={st.text}>
        Nous sommes actuellement en <strong>phase pilote</strong>, avec une sélection très restreinte de dog-sitters. À ce stade, nous ne pourrons malheureusement pas retenir ta candidature.
      </Text>
      <Text style={st.muted}>
        Rien n&apos;est définitif — à mesure que la plateforme grandit, nous rouvrirons les candidatures. Merci encore pour ta confiance&nbsp;!
      </Text>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st: Record<string, CSSProperties> = {
  body: { margin: 0, padding: 0, backgroundColor: "#f8fafc", fontFamily: FF },
  container: { margin: "0 auto", padding: "32px 28px 40px", width: "100%", maxWidth: 540, backgroundColor: "#ffffff" },
  logoSection: { padding: "0 0 20px" },
  divider: { borderTop: "1px solid #e5e7eb", margin: "0 0 28px" },
  dividerBottom: { borderTop: "1px solid #e5e7eb", margin: "28px 0 16px" },
  greeting: { margin: "0 0 12px", fontFamily: FF, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: "#0f172a" },
  text: { margin: "0 0 14px", fontFamily: FF, fontSize: 14, lineHeight: "22px", color: "#374151" },
  ctaSection: { padding: "16px 0 12px" },
  cta: { backgroundColor: "#1e40af", color: "#ffffff", fontFamily: FF, fontSize: 14, fontWeight: 600, textDecoration: "none", padding: "11px 22px", borderRadius: 7, display: "inline-block" },
  muted: { margin: 0, fontFamily: FF, fontSize: 13, lineHeight: "20px", color: "#64748b" },
  link: { color: "#1e40af", textDecoration: "none" },
  footer: { margin: 0, fontFamily: FF, fontSize: 12, lineHeight: "18px", color: "#9ca3af", textAlign: "center" },
  footerLink: { color: "#9ca3af", textDecoration: "none" },
};
