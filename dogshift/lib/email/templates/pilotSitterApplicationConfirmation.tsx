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

// ── Social SVGs (footer) ──────────────────────────────────────────────────────
const SVG_INSTAGRAM = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="6" stroke="#94a3b8" stroke-width="1.8"/><circle cx="12" cy="12" r="4" stroke="#94a3b8" stroke-width="1.8"/><circle cx="17.5" cy="6.5" r="1" fill="#94a3b8"/></svg>`;
const SVG_FACEBOOK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_GLOBE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#94a3b8" stroke-width="1.8"/><path d="M12 2c-2.5 3-4 6-4 10s1.5 7 4 10M12 2c2.5 3 4 6 4 10s-1.5 7-4 10M2 12h20" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/></svg>`;

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
      <Head />
      <Preview>{previewText}</Preview>
      <Body className="ds-outer" style={s.body}>
        <Container style={s.container}>
          {/* Purple hero */}
          <Section style={s.hero}>

          {/* Logo at top of hero — white circle */}
          <div style={{ marginBottom: 24 }}>
            <Link href={baseUrl} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "10px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", background: "#ffffff", flexShrink: 0 }}>
                <Img src={logoUrl} width={24} height={24} alt="" style={{ display: "block", width: 24, height: 24, border: 0 }} />
              </span>
              <Text style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.3px", display: "inline" }}>DogShift</Text>
            </Link>
          </div>
          <div style={s.heroLabel}>CANDIDATURE REÇUE</div>
            <Text style={s.heroTitle}>
              Merci{firstName ? ` ${firstName}` : ""}, ta candidature est bien enregistrée.
            </Text>
            <Text style={s.heroSubtitle}>
              Nous avons bien reçu tes informations pour rejoindre DogShift en tant que dog-sitter (phase pilote).
            </Text>
          </Section>

          {/* White card body */}
          <Section className="ds-card" style={s.card}>
            <div style={s.cardBody}>

              <Text style={s.stepsTitle}>Prochaines étapes</Text>

              {[
                "Analyse de ton profil — sélection manuelle par notre équipe",
                "On te recontacte si ton profil est retenu pour la phase pilote",
                "Entretien de 15 min, puis activation de ton profil",
              ].map((step, i) => (
                <div key={i} style={s.stepItem}>
                  <span style={s.stepNum}>{i + 1}</span>
                  <span style={s.stepText}>{step}</span>
                </div>
              ))}

              <Section style={{ textAlign: "center", padding: "24px 0 8px" }}>
                <Button href={ctaUrl} style={s.cta}>
                  Découvrir DogShift
                </Button>
              </Section>

              <Text style={s.muted}>
                Garde cet email — on te contactera directement si une place est disponible.
              </Text>
            </div>
          </Section>

          {/* Footer */}
          <Section style={s.footerSection}>
            <div style={s.socialRow}>
              <a href="https://instagram.com/dogshift" style={s.socialLink} dangerouslySetInnerHTML={{ __html: SVG_INSTAGRAM }} />
              <a href="https://facebook.com/dogshift" style={s.socialLink} dangerouslySetInnerHTML={{ __html: SVG_FACEBOOK }} />
              <a href={baseUrl || "https://dogshift.ch"} style={s.socialLink} dangerouslySetInnerHTML={{ __html: SVG_GLOBE }} />
            </div>
            <div style={s.divider} />
            <Text style={s.footerText}>
              DogShift &middot; support@dogshift.ch &middot; Plateforme de dogsitting premium en Suisse
            </Text>
            <Text style={s.footerText}>
              <Link href={baseUrl || "https://dogshift.ch"} style={s.footerLink}>dogshift.ch</Link>
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

export function pilotSitterApplicationConfirmationCtaUrl(baseUrl: string) {
  const b = (baseUrl || "").trim().replace(/\/$/, "");
  return b ? `${b}/devenir-dogsitter` : "https://dogshift.ch/devenir-dogsitter";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: "#f1f5f9",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif",
  },
  container: { margin: "0 auto", padding: "32px 12px 40px", width: "100%", maxWidth: 600 },

  // Logo
  logoSection: { textAlign: "center", padding: "0 0 24px" },
  brandName: { margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.4px" },

  // Hero
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
  heroTitle: {
    margin: "0 0 12px",
    fontSize: 26,
    fontWeight: 800,
    lineHeight: "32px",
    color: "#ffffff",
    letterSpacing: "-0.4px",
  },
  heroSubtitle: { margin: 0, fontSize: 15, lineHeight: "22px", color: "rgba(255,255,255,0.85)" },

  // Card body
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "0 0 16px 16px",
    border: "1px solid #e2e8f0",
    borderTop: "none",
    boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
  },
  cardBody: { padding: "32px 36px 36px" },

  stepsTitle: {
    margin: "0 0 16px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: "#64748b",
  },
  stepItem: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  stepNum: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#ede9fe",
    color: "#7c3aed",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  stepText: { fontSize: 14, lineHeight: "22px", color: "#475569" },

  cta: {
    backgroundColor: "#6366f1",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    padding: "14px 28px",
    borderRadius: 10,
    display: "inline-block",
  },
  muted: { margin: "16px 0 0", fontSize: 12, lineHeight: "18px", color: "#94a3b8", textAlign: "center" },

  // Footer
  footerSection: { padding: "24px 4px 0", textAlign: "center" },
  socialRow: { display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 },
  socialLink: { textDecoration: "none", display: "inline-block" },
  divider: { height: 1, background: "#e2e8f0", margin: "0 0 12px" },
  footerText: { margin: "0 0 4px", fontSize: 11, lineHeight: "17px", color: "#94a3b8", textAlign: "center" },
  footerLink: { color: "#94a3b8", textDecoration: "none" },
};
