export type EmailSummaryRow = {
  label: string;
  value: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(url: string) {
  const u = (url || "").trim();
  return u;
}

export function renderEmailLayout(params: {
  brandName?: string;
  logoUrl?: string;
  title: string;
  subtitle?: string;
  summaryTitle?: string;
  summaryRows?: EmailSummaryRow[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerText?: string;
}) {
  const brandName = (params.brandName || "DogShift").trim() || "DogShift";
  const title = escapeHtml(params.title);
  const subtitle = params.subtitle ? escapeHtml(params.subtitle) : "";
  const logoUrl = params.logoUrl ? safeUrl(params.logoUrl) : "";

  const summaryTitle = escapeHtml(params.summaryTitle || "Résumé");
  const rows = Array.isArray(params.summaryRows) ? params.summaryRows : [];

  const ctaUrl = params.ctaUrl ? safeUrl(params.ctaUrl) : "";
  const ctaLabel = params.ctaLabel ? escapeHtml(params.ctaLabel) : "";

  const footerText = escapeHtml(
    params.footerText || "DogShift • support@dogshift.ch • Ceci est un email automatique, merci de ne pas répondre."
  );

  const summaryHtml = rows.length
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#111827;">${summaryTitle}</td>
        </tr>
        ${rows
          .map((r) => {
            const label = escapeHtml(r.label);
            const value = escapeHtml(r.value);
            return `
              <tr>
                <td style="padding:8px 0;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">
                  <div style="color:#6b7280;font-size:12px;line-height:16px;">${label}</div>
                  <div style="font-size:14px;line-height:18px;">${value}</div>
                </td>
              </tr>
            `;
          })
          .join("")}
      </table>
    `
    : "";

  const ctaHtml = ctaUrl && ctaLabel
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:18px 0 0 0;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;padding:12px 18px;border-radius:10px;">
              ${ctaLabel}
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="120" height="28" alt="${escapeHtml(brandName)}" style="display:block;border:0;outline:none;text-decoration:none;" />`
    : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#111827;">${escapeHtml(brandName)}</div>`;

  const subtitleHtml = subtitle
    ? `<div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#6b7280;">${subtitle}</div>`
    : "";

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">${title}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f3f4f6;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="border-collapse:collapse;width:560px;max-width:560px;">
            <tr>
              <td style="padding:0 0 14px 0;">${logoHtml}</td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-radius:16px;padding:22px;border:1px solid #e5e7eb;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;line-height:26px;color:#111827;">${title}</div>
                ${subtitleHtml}
                <div style="height:16px;line-height:16px;font-size:16px;">&nbsp;</div>
                ${summaryHtml}
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 4px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;">
                ${footerText}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html };
}
