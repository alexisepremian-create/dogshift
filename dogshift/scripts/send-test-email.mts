import { renderEmailLayout } from "../lib/email/templates/layout.ts";
import { buildTravelMapUrl } from "../lib/travel/staticMap.ts";

const TO = process.argv[2] || "mariedupont.shift@gmail.com";
const RESEND_KEY = process.env.RESEND_API_KEY;
if (!RESEND_KEY) { console.error("RESEND_API_KEY not set"); process.exit(1); }

const BASE_URL = "https://www.dogshift.ch";
const LOGO_URL = `${BASE_URL}/dogshift-logo.png`;
const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";

const rows = [
  { label: "Service", value: "Promenade (1h)" },
  { label: "Début", value: "lun. 06 mai 2026, 10:00" },
  { label: "Fin", value: "lun. 06 mai 2026, 11:00" },
  { label: "Sous-total service", value: "35.00 CHF" },
  { label: "Frais de déplacement", value: "9.50 CHF" },
  { label: "Total", value: "44.50 CHF" },
  { label: "Référence", value: "bk_preview_demo_2026" },
];

const mapUrl = buildTravelMapUrl({
  sitterLat: 46.519, sitterLng: 6.6323,
  ownerLat: 46.5094, ownerLng: 6.6627,
});

const mapHtml = mapUrl
  ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:18px;"><tr><td style="padding:0;"><img src="${mapUrl}" alt="Carte du trajet" width="516" style="display:block;width:100%;max-width:516px;height:auto;border-radius:12px;" /></td></tr><tr><td style="padding:10px 0 0;text-align:center;font-family:${FF};font-size:13px;line-height:18px;color:#475569;"><strong style="color:#4f46e5;">4.8 km</strong>&nbsp;·&nbsp;<span style="color:#059669;font-weight:600;">Frais : CHF 9.50</span>&nbsp;·&nbsp;Le sitter se déplace chez vous</td></tr></table>`
  : "";

const { html } = renderEmailLayout({
  logoUrl: LOGO_URL,
  title: "Réservation confirmée",
  subtitle: "Ta réservation a été confirmée. Voici les détails de ta prestation.",
  summaryRows: rows,
  extraHtml: mapHtml,
  ctaLabel: "Voir la réservation",
  ctaUrl: `${BASE_URL}/account/bookings/bk_preview_demo_2026`,
});

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${RESEND_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "DogShift <no-reply@dogshift.ch>",
    to: TO,
    subject: "[TEST] Réservation confirmée – DogShift",
    text: "Ceci est un email de test pour le template booking-confirmed.",
    html,
  }),
});

const data = await res.json();
console.log(`Status: ${res.status}`);
console.log(`Sent to: ${TO}`);
console.log(`Response:`, JSON.stringify(data, null, 2));
