/**
 * DogShift — Unified email layout
 *
 * Design principles:
 *  - Professional, clean, no emojis (inline SVG icons only)
 *  - DogShift brand: dark navy #2f4d6b + white
 *  - Full dark mode support via @media (prefers-color-scheme: dark)
 *  - Table-based HTML for maximum email client compatibility
 *  - Footer with social media icons (SVG)
 */

export type EmailSummaryRow = {
  label: string;
  value: string;
};

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────

const ICONS = {
  check: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;"><circle cx="8" cy="8" r="8" fill="#22c55e"/><path d="M5 8.5l2 2 4-4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  info: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;"><circle cx="8" cy="8" r="8" fill="#3b82f6"/><path d="M8 7v4M8 5.5v.01" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;"><path d="M8 2L14.5 13H1.5L8 2Z" fill="#f59e0b"/><path d="M8 6.5v3M8 11v.01" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  arrow: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;margin-left:4px;"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// Social icon SVGs (sized for footer, monochrome)
const SOCIAL = {
  instagram: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="6" stroke="#94a3b8" stroke-width="1.8"/><circle cx="12" cy="12" r="4" stroke="#94a3b8" stroke-width="1.8"/><circle cx="17.5" cy="6.5" r="1" fill="#94a3b8"/></svg>`,
  facebook: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  globe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#94a3b8" stroke-width="1.8"/><path d="M12 2c-2.5 3-4 6-4 10s1.5 7 4 10M12 2c2.5 3 4 6 4 10s-1.5 7-4 10M2 12h20" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/></svg>`,
};

// ── Dark mode CSS ────────────────────────────────────────────────────────────

const DARK_MODE_CSS = `
<style>
  /* ── Dark mode overrides ── */
  @media (prefers-color-scheme: dark) {
    body, .ds-outer { background-color: #0f172a !important; }
    .ds-card { background-color: #1e293b !important; border-color: #334155 !important; }
    .ds-header { background-color: #1e293b !important; border-bottom-color: #334155 !important; }
    .ds-title { color: #f1f5f9 !important; }
    .ds-subtitle { color: #94a3b8 !important; }
    .ds-body-text { color: #cbd5e1 !important; }
    .ds-summary-title { color: #e2e8f0 !important; }
    .ds-row-border { border-top-color: #334155 !important; }
    .ds-row-label { color: #64748b !important; }
    .ds-row-value { color: #e2e8f0 !important; }
    .ds-cta-btn { background-color: #3b82f6 !important; }
    .ds-secondary-link { color: #94a3b8 !important; }
    .ds-footer-outer { background-color: #0f172a !important; }
    .ds-footer-text { color: #475569 !important; }
    .ds-footer-link { color: #64748b !important; }
    .ds-divider { background-color: #1e293b !important; }
    .ds-badge { background-color: #1e3a5f !important; color: #93c5fd !important; }
    .ds-highlight { background-color: #1e293b !important; border-left-color: #3b82f6 !important; }
    .ds-highlight-text { color: #cbd5e1 !important; }
  }
  /* Forced dark mode for admin preview */
  .ds-force-dark body, .ds-force-dark .ds-outer { background-color: #0f172a !important; }
  .ds-force-dark .ds-card { background-color: #1e293b !important; border-color: #334155 !important; }
  .ds-force-dark .ds-header { background-color: #1e293b !important; border-bottom-color: #334155 !important; }
  .ds-force-dark .ds-title { color: #f1f5f9 !important; }
  .ds-force-dark .ds-subtitle { color: #94a3b8 !important; }
  .ds-force-dark .ds-body-text { color: #cbd5e1 !important; }
  .ds-force-dark .ds-summary-title { color: #e2e8f0 !important; }
  .ds-force-dark .ds-row-border { border-top-color: #334155 !important; }
  .ds-force-dark .ds-row-label { color: #64748b !important; }
  .ds-force-dark .ds-row-value { color: #e2e8f0 !important; }
  .ds-force-dark .ds-secondary-link { color: #94a3b8 !important; }
  .ds-force-dark .ds-footer-outer { background-color: #0f172a !important; }
  .ds-force-dark .ds-footer-text { color: #475569 !important; }
  .ds-force-dark .ds-footer-link { color: #64748b !important; }
  .ds-force-dark .ds-divider { background-color: #1e293b !important; }
  .ds-force-dark .ds-badge { background-color: #1e3a5f !important; color: #93c5fd !important; }
  .ds-force-dark .ds-highlight { background-color: #1e293b !important; border-left-color: #3b82f6 !important; }
  .ds-force-dark .ds-highlight-text { color: #cbd5e1 !important; }
</style>`;

// ── Layout builder ────────────────────────────────────────────────────────────

export function renderEmailLayout(params: {
  brandName?: string;
  logoUrl?: string;
  title: string;
  subtitle?: string;
  /** Optional colored accent banner under the header (hex color string) */
  accentColor?: string;
  summaryTitle?: string;
  summaryRows?: EmailSummaryRow[];
  /** Raw HTML injected between the summary table and the CTA button */
  extraHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryLinkLabel?: string;
  secondaryLinkUrl?: string;
  footerLinks?: { label: string; url: string }[];
  footerText?: string;
  /** Base URL for building absolute social links, defaults to https://dogshift.ch */
  baseUrl?: string;
}) {
  const brandName = (params.brandName || "DogShift").trim() || "DogShift";
  const title = esc(params.title);
  const subtitle = params.subtitle ? esc(params.subtitle) : "";
  const logoUrl = params.logoUrl ?? "";
  const baseUrl = (params.baseUrl || "https://dogshift.ch").replace(/\/$/, "");
  const accent = params.accentColor || "#2f4d6b";

  const summaryTitle = esc(params.summaryTitle || "Résumé");
  const rows = Array.isArray(params.summaryRows) ? params.summaryRows : [];
  const ctaUrl = params.ctaUrl ?? "";
  const ctaLabel = params.ctaLabel ? esc(params.ctaLabel) : "";
  const secondaryLinkUrl = params.secondaryLinkUrl ?? "";
  const secondaryLinkLabel = params.secondaryLinkLabel ? esc(params.secondaryLinkLabel) : "";
  const footerLinks = Array.isArray(params.footerLinks) ? params.footerLinks : [];
  const footerText = esc(
    params.footerText ||
      "DogShift &bull; support@dogshift.ch &bull; Plateforme de dogsitting premium en Suisse",
  );

  // ── Logo block ─────────────────────────────────────────────────────────────
  const logoHtml = logoUrl
    ? `<a href="${esc(baseUrl)}" style="text-decoration:none;display:inline-block;line-height:1;">
        <img src="${esc(logoUrl)}" width="140" alt="${esc(brandName)}" style="display:block;width:140px;max-width:140px;height:auto;border:0;outline:none;text-decoration:none;" />
       </a>`
    : `<a href="${esc(baseUrl)}" style="text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">${esc(brandName)}</a>`;

  // ── Summary table ──────────────────────────────────────────────────────────
  const summaryHtml = rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:4px;">
        <tr>
          <td style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#64748b;" class="ds-row-label ds-summary-title">${summaryTitle}</td>
        </tr>
        ${rows
          .map((r) => {
            const label = esc(r.label);
            const value = esc(r.value);
            return `<tr>
              <td style="padding:10px 0;border-top:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;" class="ds-row-border">
                <div style="font-size:11px;line-height:15px;color:#94a3b8;margin-bottom:2px;font-weight:500;" class="ds-row-label">${label}</div>
                <div style="font-size:14px;line-height:20px;color:#0f172a;font-weight:500;" class="ds-row-value">${value}</div>
              </td>
            </tr>`;
          })
          .join("")}
      </table>`
    : "";

  // ── CTA block ──────────────────────────────────────────────────────────────
  const ctaHtml =
    ctaUrl && ctaLabel
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:24px;">
          <tr>
            <td align="center" style="text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="${esc(accent)}" style="border-radius:10px;mso-padding-alt:0;">
                    <a href="${esc(ctaUrl)}" class="ds-cta-btn" style="display:inline-block;background:${esc(accent)};color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1;padding:14px 28px;border-radius:10px;letter-spacing:0.01em;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${
            secondaryLinkUrl && secondaryLinkLabel
              ? `<tr>
                  <td align="center" style="padding:14px 0 0;text-align:center;">
                    <a href="${esc(secondaryLinkUrl)}" class="ds-secondary-link" style="color:#64748b;text-decoration:underline;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">${secondaryLinkLabel}</a>
                  </td>
                </tr>`
              : ""
          }
        </table>`
      : "";

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerLinksHtml = footerLinks.length
    ? footerLinks
        .map((l) => `<a href="${esc(l.url)}" class="ds-footer-link" style="color:#94a3b8;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:11px;">${esc(l.label)}</a>`)
        .join(`<span style="padding:0 8px;color:#cbd5e1;">&middot;</span>`)
    : "";

  const socialHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse;margin:12px auto 0;">
      <tr>
        <td style="padding:0 6px;">
          <a href="https://instagram.com/dogshift" title="Instagram" style="text-decoration:none;display:block;">${SOCIAL.instagram}</a>
        </td>
        <td style="padding:0 6px;">
          <a href="https://facebook.com/dogshift" title="Facebook" style="text-decoration:none;display:block;">${SOCIAL.facebook}</a>
        </td>
        <td style="padding:0 6px;">
          <a href="${esc(baseUrl)}" title="DogShift" style="text-decoration:none;display:block;">${SOCIAL.globe}</a>
        </td>
      </tr>
    </table>`;

  // ── Full HTML ──────────────────────────────────────────────────────────────
  const html = `<!doctype html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${title}</title>
  ${DARK_MODE_CSS}
</head>
<body class="ds-outer" style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;word-spacing:normal;">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;visibility:hidden;font-size:1px;line-height:1px;">${subtitle || title}</div>

  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="ds-outer" style="border-collapse:collapse;background-color:#f1f5f9;min-width:100%;">
    <tr>
      <td align="center" style="padding:32px 12px 40px 12px;">

        <!-- Email container — 600px max -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="border-collapse:collapse;width:600px;max-width:100%;">

          <!-- ── LOGO HEADER ── -->
          <tr>
            <td align="center" style="padding:0 0 20px 0;text-align:center;">
              ${logoHtml}
            </td>
          </tr>

          <!-- ── MAIN CARD ── -->
          <tr>
            <td class="ds-card" style="background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04);">

              <!-- Accent top bar -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td height="4" style="background-color:${esc(accent)};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Card body -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:32px 36px 36px 36px;">

                    <!-- Title -->
                    <h1 class="ds-title" style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;line-height:28px;color:#0f172a;letter-spacing:-0.3px;">${title}</h1>

                    ${subtitle ? `<p class="ds-subtitle" style="margin:0 0 20px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#64748b;">${subtitle}</p>` : `<div style="height:20px;line-height:20px;font-size:20px;">&nbsp;</div>`}

                    <!-- Summary rows -->
                    ${summaryHtml}

                    <!-- Extra HTML -->
                    ${params.extraHtml ?? ""}

                    <!-- CTA -->
                    ${ctaHtml}

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td class="ds-footer-outer" style="background-color:#f1f5f9;padding:24px 4px 0 4px;text-align:center;">

              <!-- Social icons -->
              ${socialHtml}

              <!-- Divider -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:16px 0 12px;">
                <tr>
                  <td height="1" class="ds-divider" style="background-color:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Footer links -->
              ${footerLinksHtml ? `<p style="margin:0 0 6px 0;text-align:center;">${footerLinksHtml}</p>` : ""}

              <!-- Footer text -->
              <p class="ds-footer-text" style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#94a3b8;text-align:center;">
                ${footerText}
              </p>
              <p class="ds-footer-text" style="margin:6px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#94a3b8;text-align:center;">
                <a href="${esc(baseUrl)}" class="ds-footer-link" style="color:#94a3b8;text-decoration:none;">dogshift.ch</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:support@dogshift.ch" class="ds-footer-link" style="color:#94a3b8;text-decoration:none;">support@dogshift.ch</a>
                &nbsp;&middot;&nbsp;
                <a href="${esc(baseUrl)}/unsubscribe" class="ds-footer-link" style="color:#94a3b8;text-decoration:underline;">Se d&eacute;sabonner</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return { html, ICONS };
}

export { ICONS as EMAIL_ICONS };
