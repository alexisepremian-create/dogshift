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

  return (
    <Html lang="fr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* Logo */}
          <Section style={styles.brandSection}>
            <Img src={logoUrl} width={152} alt="DogShift" style={styles.logo} />
          </Section>

          {/* Card */}
          <Section style={styles.card}>
            <Text style={styles.h1}>{props.subject}</Text>

            <Text style={styles.lead}>
              Bonjour{props.firstName?.trim() ? ` ${props.firstName.trim()}` : ""},
            </Text>

            {props.customMessage ? (
              <Section style={styles.messageBox}>
                {props.customMessage.split("\n").map((line, i) =>
                  line.trim() === "" ? (
                    <Text key={i} style={styles.messageSpacer}>{" "}</Text>
                  ) : (
                    <Text key={i} style={styles.messageText}>{line}</Text>
                  ),
                )}
              </Section>
            ) : null}

            <Section style={styles.ctaRow}>
              <Button href={baseUrl} style={styles.ctaPrimary}>
                Visiter DogShift
              </Button>
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.footerText}>
              Des questions ?{" "}
              <Link href="mailto:support@dogshift.ch" style={styles.link}>
                support@dogshift.ch
              </Link>
            </Text>
            <Text style={styles.footerText}>
              <Link href={baseUrl} style={styles.link}>dogshift.ch</Link>
            </Text>
          </Section>

          <Text style={styles.bottomMuted}>
            DogShift · <Link href={`${baseUrl}/cgu`} style={styles.bottomLink}>CGU</Link>
            {" · "}
            <Link href={`${baseUrl}/confidentialite`} style={styles.bottomLink}>Confidentialité</Link>
            {" · "}
            <Link href={`${baseUrl}/mentions-legales`} style={styles.bottomLink}>Mentions légales</Link>
          </Text>

          <Text style={styles.unsubscribe}>
            Vous recevez cet email car vous êtes inscrit sur DogShift.{" "}
            <Link
              href={`mailto:support@dogshift.ch?subject=D%C3%A9sabonnement%20aux%20communications%20DogShift`}
              style={styles.unsubscribeLink}
            >
              Se désabonner
            </Link>
          </Text>

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

const styles: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: "#f6f8fb",
    fontFamily:
      "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif",
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
    boxShadow: "0 18px 60px -44px rgba(2,6,23,0.25)",
  },
  h1: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    lineHeight: "26px",
    letterSpacing: "-0.2px",
    color: "#0f172a",
  },
  lead: {
    margin: "10px 0 0",
    fontSize: 14,
    lineHeight: "20px",
    color: "#334155",
  },
  messageBox: {
    marginTop: 14,
    padding: "12px 16px",
    backgroundColor: "#f0f5fb",
    borderRadius: 12,
    borderLeft: `3px solid ${brandBlue}`,
  },
  messageText: {
    margin: "2px 0",
    fontSize: 13,
    lineHeight: "19px",
    color: "#334155",
  },
  messageSpacer: {
    margin: 0,
    fontSize: 6,
    lineHeight: "6px",
    color: "transparent",
  },
  ctaRow: {
    textAlign: "center",
    paddingTop: 18,
  },
  ctaPrimary: {
    backgroundColor: brandBlue,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    padding: "11px 22px",
    borderRadius: 10,
    display: "inline-block",
    border: `1px solid ${brandBlueHover}`,
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
  link: {
    color: brandBlue,
    textDecoration: "underline",
  },
  bottomMuted: {
    margin: "14px 0 0",
    fontSize: 11,
    lineHeight: "16px",
    color: "#94a3b8",
    textAlign: "center",
  },
  bottomLink: {
    color: "#94a3b8",
    textDecoration: "underline",
  },
  unsubscribe: {
    margin: "10px 0 0",
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center" as const,
  },
  unsubscribeLink: {
    color: "#94a3b8",
    textDecoration: "underline",
  },
};
