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

const DARK_CSS = `
@media (prefers-color-scheme: dark) {
  body, .ds-outer { background-color: #0f172a !important; }
  .ds-card { background-color: #1e293b !important; border-color: #334155 !important; }
  .ds-title { color: #f1f5f9 !important; }
  .ds-lead { color: #94a3b8 !important; }
  .ds-steps { background-color: #0f172a !important; border-color: #334155 !important; }
  .ds-step-item { color: #94a3b8 !important; }
  .ds-footer-text { color: #475569 !important; }
  .ds-footer-link { color: #64748b !important; }
  .ds-muted { color: #475569 !important; }
  .ds-bottom { color: #334155 !important; }
}`;

export function pilotSitterApplicationConfirmationPlainText(params: {
  firstName: string;
  ctaUrl: string;
}) {
  const firstName = (params.firstName || "").trim() || "";
  const ctaUrl = (params.ctaUrl || "").trim();

  return (
    `Bonjour${firstName ? ` ${firstName}` : ""},\n\n` +
    `Nous avons bien reçu ta candidature pour devenir dog-sitter DogShift (phase pilote).\n\n` +
    `Prochaines étapes :\n` +
    `1) On analyse ton profil (sélection manuelle).\n` +
    `2) On te recontacte si ton profil est retenu.\n` +
    `3) Mini entretien, puis validation et activation du profil.\n\n` +
    (ctaUrl ? `Découvrir DogShift : ${ctaUrl}\n\n` : "") +
    `Besoin d'aide ? support@dogshift.ch\n\n` +
    `— DogShift\n`
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

  return (
    <Html lang="fr">
      <Head>
        <style>{DARK_CSS}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body className="ds-outer" style={s.body}>
        <Container style={s.container}>

          {/* Logo */}
          <Section style={s.logoSection}>
            <Link href={baseUrl || "https://dogshift.ch"} style={s.logoLink}>
              {logoUrl ? (
                <Img src={logoUrl} width={140} alt="DogShift" style={s.logo} />
              ) : (
                <Text style={s.brandFallback}>DogShift</Text>
              )}
            </Link>
          </Section>

          {/* Main card */}
          <Section className="ds-card" style={s.card}>
            <div style={s.accentBar} />
            <div style={s.cardBody}>

              {/* Status badge */}
              <div style={{ marginBottom: 12 }}>
                <span
                  style={{
                    display: "inline-block",
                    background: "#dcfce7",
                    color: "#15803d",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    padding: "3px 10px",
                    borderRadius: 20,
                  }}
                >
                  Candidature reçue
                </span>
              </div>

              <Text className="ds-title" style={s.h1}>
                Merci{firstName ? ` ${firstName}` : ""}, ta candidature est bien enregistrée.
              </Text>
              <Text className="ds-lead" style={s.lead}>
                Nous avons bien reçu tes informations pour rejoindre DogShift en tant que dog-sitter (phase pilote).
              </Text>

              {/* Steps */}
              <Section className="ds-steps" style={s.steps}>
                <Text style={s.stepsTitle}>Prochaines étapes</Text>
                <Text className="ds-step-item" style={s.stepItem}>
                  <strong>1.</strong> Analyse de ton profil — sélection manuelle par notre équipe
                </Text>
                <Text className="ds-step-item" style={s.stepItem}>
                  <strong>2.</strong> On te recontacte si ton profil est retenu pour la phase pilote
                </Text>
                <Text className="ds-step-item" style={s.stepItem}>
                  <strong>3.</strong> Entretien de 15 min, puis activation de ton profil
                </Text>
              </Section>

              <Section style={s.ctaRow}>
                <Button href={ctaUrl} style={s.cta}>
                  Découvrir DogShift
                </Button>
              </Section>

              <Text className="ds-muted" style={s.muted}>
                Garde cet email — on te contactera directement si une place est disponible.
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
            <Link href={baseUrl || "https://dogshift.ch"} className="ds-footer-link" style={s.footerLink}>
              dogshift.ch
            </Link>
          </Text>
          <Text className="ds-bottom" style={s.bottomMuted}>
            DogShift · Plateforme de dogsitting premium en Suisse · Email automatique.
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
  brandFallback: {
    margin: 0,
    fontWeight: 800,
    fontSize: 20,
    letterSpacing: "-0.3px",
    color: "#0f172a",
  },
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
    fontSize: 22,
    fontWeight: 800,
    lineHeight: "28px",
    letterSpacing: "-0.3px",
    color: "#0f172a",
  },
  lead: { margin: "12px 0 0", fontSize: 14, lineHeight: "22px", color: "#475569" },
  steps: {
    marginTop: 20,
    padding: "16px 16px 8px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
  },
  stepsTitle: {
    margin: "0 0 10px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: "#64748b",
  },
  stepItem: { margin: "8px 0 0", fontSize: 13, lineHeight: "20px", color: "#475569" },
  ctaRow: { textAlign: "center", padding: "20px 0 8px" },
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
  muted: { margin: "16px 0 0", fontSize: 12, lineHeight: "18px", color: "#94a3b8" },
  footerText: {
    margin: "20px 0 0",
    fontSize: 12,
    lineHeight: "18px",
    color: "#94a3b8",
    textAlign: "center",
  },
  footerLink: { color: "#64748b", textDecoration: "none" },
  bottomMuted: { margin: "8px 0 0", fontSize: 11, lineHeight: "16px", color: "#cbd5e1", textAlign: "center" },
};
