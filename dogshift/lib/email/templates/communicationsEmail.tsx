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

const ACCENT = "#2f4d6b";

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

          {/* Card */}
          <Section className="ds-card" style={s.card}>
            <div style={s.accentBar} />
            <div style={s.cardBody}>
              <Text className="ds-title" style={s.h1}>{props.subject}</Text>
              <Text className="ds-lead" style={s.lead}>
                Bonjour{firstName ? ` ${firstName}` : ""},
              </Text>

              {props.customMessage ? (
                <Section className="ds-msg-box" style={s.messageBox}>
                  {props.customMessage.split("\n").map((line, i) =>
                    line.trim() === "" ? (
                      <Text key={i} style={s.messageSpacer}>{" "}</Text>
                    ) : (
                      <Text key={i} className="ds-msg-text" style={s.messageText}>{line}</Text>
                    ),
                  )}
                </Section>
              ) : null}

              <Section style={s.ctaRow}>
                <Button href={baseUrl} style={s.cta}>
                  Visiter DogShift
                </Button>
              </Section>
            </div>
          </Section>

          {/* Footer */}
          <Text className="ds-footer-text" style={s.footerText}>
            Questions ?{" "}
            <Link href="mailto:support@dogshift.ch" className="ds-footer-link" style={s.footerLink}>
              support@dogshift.ch
            </Link>
            {" "}·{" "}
            <Link href={baseUrl} className="ds-footer-link" style={s.footerLink}>
              dogshift.ch
            </Link>
          </Text>
          <Text className="ds-bottom" style={s.bottomMuted}>
            <Link href={`${baseUrl}/cgu`} style={s.legalLink}>CGU</Link>
            {" · "}
            <Link href={`${baseUrl}/confidentialite`} style={s.legalLink}>Confidentialité</Link>
            {" · "}
            <Link
              href={`mailto:support@dogshift.ch?subject=D%C3%A9sabonnement`}
              style={s.legalLink}
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
  logoSection: { textAlign: "center", padding: "0 0 20px" },
  logoLink: { display: "inline-block" },
  logo: { display: "block", margin: "0 auto", height: "auto" },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)",
  },
  accentBar: { height: 4, backgroundColor: ACCENT, fontSize: 0, lineHeight: "0" },
  cardBody: { padding: "32px 36px 36px" },
  h1: {
    margin: "0 0 8px",
    fontSize: 20,
    fontWeight: 800,
    lineHeight: "26px",
    letterSpacing: "-0.3px",
    color: "#0f172a",
  },
  lead: { margin: "0 0 4px", fontSize: 14, lineHeight: "22px", color: "#475569" },
  messageBox: {
    marginTop: 16,
    padding: "14px 18px",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderLeft: `3px solid ${ACCENT}`,
    border: "1px solid #e2e8f0",
  },
  messageText: { margin: "2px 0", fontSize: 14, lineHeight: "22px", color: "#334155" },
  messageSpacer: { margin: 0, fontSize: 6, lineHeight: "6px", color: "transparent" },
  ctaRow: { textAlign: "center", padding: "20px 0 4px" },
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
  footerText: {
    margin: "20px 0 0",
    fontSize: 12,
    lineHeight: "18px",
    color: "#94a3b8",
    textAlign: "center",
  },
  footerLink: { color: "#64748b", textDecoration: "none" },
  bottomMuted: { margin: "8px 0 0", fontSize: 11, lineHeight: "16px", color: "#cbd5e1", textAlign: "center" },
  legalLink: { color: "#cbd5e1", textDecoration: "underline" },
};
