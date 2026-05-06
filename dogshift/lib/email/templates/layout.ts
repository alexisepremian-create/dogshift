/**
 * DogShift — Unified email layout
 *
 * ALL emails share the exact same structure:
 *   1. DogShift logo  (centered, gray background)
 *   2. Purple gradient hero  (heroLabel badge · title · subtitle)
 *   3. White content card  (summaryRows · extraHtml · CTA)
 *   4. Footer  (social icons · legal links)
 *
 * Pass `title` + optional `subtitle` → they render in the purple hero.
 * Use `heroLabel` for the small uppercase badge inside the hero.
 * Put body content in `extraHtml` and/or `summaryRows`.
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

// ── Force light mode CSS (prevents Gmail/iOS auto-dark-mode) ─────────────────

const DARK_MODE_CSS = `
<style type="text/css">
  /* Force light-only rendering — Apple Mail, iOS Mail */
  :root { color-scheme: light only !important; }
  /* Gmail dark mode override — Gmail adds [data-ogsc] to :root when dark */
  :root[data-ogsc] body,
  :root[data-ogsc] .ds-outer { background-color: #f1f5f9 !important; }
  :root[data-ogsc] .ds-card  { background-color: #ffffff !important; border-color: #e2e8f0 !important; }
  :root[data-ogsc] .ds-card td,
  :root[data-ogsc] .ds-card p,
  :root[data-ogsc] .ds-card div,
  :root[data-ogsc] .ds-card span { color: #475569 !important; }
  :root[data-ogsc] .ds-card strong,
  :root[data-ogsc] .ds-card b    { color: #0f172a !important; }
  /* Gmail iOS extra hack (u+ selector only parsed by Gmail) */
  u + .ds-outer .ds-card { background-color: #ffffff !important; }
  u + .ds-outer body     { background-color: #f1f5f9 !important; }
</style>`;

// ── Main layout function ──────────────────────────────────────────────────────

export function renderEmailLayout(params: {
  brandName?: string;
  logoUrl?: string;
  /** Small uppercase badge inside the purple hero (e.g. "CANDIDATURE REÇUE") */
  heroLabel?: string;
  /** Big white title shown in the purple gradient hero */
  title: string;
  /** Subtitle shown below the title in the purple hero */
  subtitle?: string;
  summaryTitle?: string;
  summaryRows?: EmailSummaryRow[];
  /** Raw HTML injected in the white content card */
  extraHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryLinkLabel?: string;
  secondaryLinkUrl?: string;
  /** URL of the closing banner image (email-banners/banner-*.jpg) */
  bannerImageUrl?: string;
  /** CTA label shown under the banner image */
  bannerCtaLabel?: string;
  /** CTA URL for the banner button */
  bannerCtaUrl?: string;
  footerLinks?: { label: string; url: string }[];
  footerText?: string;
  /** Base URL for absolute links, defaults to https://dogshift.ch */
  baseUrl?: string;
  /** @deprecated use title/subtitle — kept for backwards compatibility */
  accentColor?: string;
}) {
  const brandName = (params.brandName || "DogShift").trim() || "DogShift";
  const title = esc(params.title);
  const subtitle = params.subtitle ? esc(params.subtitle) : "";
  const heroLabel = params.heroLabel ? esc(params.heroLabel) : "";
  const logoUrl = params.logoUrl ?? "";
  const baseUrl = (params.baseUrl || "https://dogshift.ch").replace(/\/$/, "");
  // CTA button uses indigo to match the hero gradient; accentColor kept for compat
  const ctaBg = params.accentColor || "#6366f1";

  const summaryTitle = esc(params.summaryTitle || "Résumé");
  const rows = Array.isArray(params.summaryRows) ? params.summaryRows : [];
  const ctaUrl = params.ctaUrl ?? "";
  // Default banner: hero image unless explicitly disabled (set bannerImageUrl to "")
  const bannerImageUrl = params.bannerImageUrl !== undefined
    ? params.bannerImageUrl
    : `${baseUrl}/email-banners/banner-hero.jpg`;
  const bannerCtaUrl = params.bannerCtaUrl ?? `${baseUrl}/sitters`;
  const bannerCtaLabel = params.bannerCtaLabel ?? "Voir les dog-sitters →";
  const ctaLabel = params.ctaLabel ? esc(params.ctaLabel) : "";
  const secondaryLinkUrl = params.secondaryLinkUrl ?? "";
  const secondaryLinkLabel = params.secondaryLinkLabel ? esc(params.secondaryLinkLabel) : "";
  const footerLinks = Array.isArray(params.footerLinks) ? params.footerLinks : [];
  const footerText = esc(
    params.footerText ||
      "DogShift \u00b7 support@dogshift.ch \u00b7 Plateforme de dogsitting premium en Suisse",
  );

  // ── Logo block (white circle + white text — lives inside the purple hero) ───
  const logoHtml = logoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td align="center" valign="middle" style="width:44px;height:44px;background-color:#ffffff;border-radius:22px;padding:7px;">
            <img src="${esc(logoUrl)}" width="30" height="30" alt="" style="display:inline-block;vertical-align:middle;border:0;outline:none;" />
          </td>
          <td style="padding-left:10px;vertical-align:middle;">
            <a href="${esc(baseUrl)}" style="text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:17px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">${esc(brandName)}</a>
          </td>
        </tr>
      </table>`
    : `<a href="${esc(baseUrl)}" style="text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:17px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">${esc(brandName)}</a>`;

  // ── Summary table ───────────────────────────────────────────────────────────
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

  // ── CTA block ───────────────────────────────────────────────────────────────
  const ctaHtml =
    ctaUrl && ctaLabel
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:24px;">
          <tr>
            <td align="center" style="text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="${esc(ctaBg)}" style="border-radius:10px;mso-padding-alt:0;">
                    <a href="${esc(ctaUrl)}" style="display:inline-block;background:${esc(ctaBg)};color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1;padding:14px 28px;border-radius:10px;letter-spacing:0.01em;">
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
                    <a href="${esc(secondaryLinkUrl)}" style="color:#64748b;text-decoration:underline;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">${secondaryLinkLabel}</a>
                  </td>
                </tr>`
              : ""
          }
        </table>`
      : "";

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footerLinksHtml = footerLinks.length
    ? footerLinks
        .map((l) => `<a href="${esc(l.url)}" class="ds-footer-link" style="color:#94a3b8;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:11px;">${esc(l.label)}</a>`)
        .join(`<span style="padding:0 8px;color:#cbd5e1;">&middot;</span>`)
    : "";

  const socialHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse;margin:12px auto 0;">
      <tr>
        <td style="padding:0 10px;">
          <a href="https://instagram.com/dogshift" title="Instagram" style="text-decoration:none;display:inline-block;">
            <img src="${esc(baseUrl)}/icons/instagram.png" width="32" height="32" alt="Instagram" style="display:block;border:0;outline:none;" />
          </a>
        </td>
        <td style="padding:0 10px;">
          <a href="https://facebook.com/dogshift" title="Facebook" style="text-decoration:none;display:inline-block;">
            <img src="${esc(baseUrl)}/icons/facebook.png" width="32" height="32" alt="Facebook" style="display:block;border:0;outline:none;" />
          </a>
        </td>
        <td style="padding:0 10px;">
          <a href="${esc(baseUrl)}" title="DogShift" style="text-decoration:none;display:inline-block;">
            <img src="${esc(baseUrl)}/icons/globe.png" width="32" height="32" alt="DogShift" style="display:block;border:0;outline:none;" />
          </a>
        </td>
      </tr>
    </table>`;

  // Has body content?
  const hasBody = !!(summaryHtml || params.extraHtml || ctaHtml);

  // ── Full HTML ────────────────────────────────────────────────────────────────
  const html = `<!doctype html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
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

        <!-- Email container 600px -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="border-collapse:collapse;width:600px;max-width:100%;">

          <!-- ── PURPLE GRADIENT HERO (logo + label + title + subtitle) ── -->
          <tr>
            <td style="border-radius:${hasBody ? "16px 16px 0 0" : "16px"};overflow:hidden;background:linear-gradient(135deg,#7c3aed 0%,#6366f1 55%,#818cf8 100%);">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:28px 36px 32px 36px;">

                    <!-- Logo at top of hero -->
                    <div style="margin-bottom:24px;">
                      ${logoHtml}
                    </div>

                    ${heroLabel ? `<div style="display:inline-block;background:rgba(255,255,255,0.18);color:rgba(255,255,255,0.95);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:4px 12px;border-radius:20px;margin-bottom:16px;">${heroLabel}</div>` : ""}

                    <h1 style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;line-height:32px;color:#ffffff;letter-spacing:-0.4px;">${title}</h1>

                    ${subtitle ? `<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:rgba(255,255,255,0.85);">${subtitle}</p>` : ""}

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${hasBody ? `
          <!-- ── WHITE CONTENT CARD ── -->
          <tr>
            <td class="ds-card" style="background-color:#ffffff;border-radius:0 0 16px 16px;border:1px solid #e2e8f0;border-top:none;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:32px 36px 36px 36px;">

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
          ` : ""}

          <!-- ── CLOSING BANNER ── -->
          ${bannerImageUrl ? `
          <tr>
            <td style="padding:20px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border-radius:16px;overflow:hidden;background-color:#ffffff;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
                <tr>
                  <td style="padding:0;line-height:0;font-size:0;">
                    <img src="${esc(bannerImageUrl)}" width="600" alt="" style="display:block;width:100%;max-width:600px;border:0;border-radius:16px 16px 0 0;" />
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#ffffff;padding:22px 36px 28px;text-align:center;border-radius:0 0 16px 16px;">
                    <a href="${esc(bannerCtaUrl)}" style="display:inline-block;background-color:#6366f1;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:10px;">${esc(bannerCtaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- ── FOOTER ── -->
          <tr>
            <td class="ds-footer-outer" style="background-color:#f1f5f9;padding:24px 4px 0 4px;text-align:center;">

              ${socialHtml}

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:16px 0 12px;">
                <tr>
                  <td height="1" class="ds-divider" style="background-color:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              ${footerLinksHtml ? `<p style="margin:0 0 6px 0;text-align:center;">${footerLinksHtml}</p>` : ""}

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
