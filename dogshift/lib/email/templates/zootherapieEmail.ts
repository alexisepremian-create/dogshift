function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderZootherapieEmail(params: {
  baseUrl: string;
  prenom: string;
  titre: string;
  analyseRows: { label: string; value: string }[];
  conseil: string;
  conclusion: string;
}): { html: string } {
  const { baseUrl, prenom, titre, analyseRows, conseil, conclusion } = params;

  const logoUrl = `${baseUrl}/dogshift-logo.png`;
  const heroImageUrl = `${baseUrl}/images/zootherapie/zootherapie5.jpg`;
  const siteUrl = escapeHtml(baseUrl);
  const searchUrl = escapeHtml(`${baseUrl}/search`);

  const analyseHtml = analyseRows
    .map((row) => {
      const isArrow = row.label === "↓";
      if (isArrow) {
        return `
          <tr>
            <td style="padding:0 0 14px 0;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:24px;color:#374151;font-style:italic;">
                ${escapeHtml(row.value)}
              </div>
            </td>
          </tr>`;
      }
      return `
        <tr>
          <td style="padding:0 0 14px 0;">
            <div style="display:inline-block;background:#ede9fe;color:#6d28d9;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:3px 10px;border-radius:20px;margin-bottom:6px;">
              ${escapeHtml(row.label)}
            </div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:24px;color:#111827;">
              ${escapeHtml(row.value)}
            </div>
          </td>
        </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(titre)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <!-- Preview text -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    Bonjour ${escapeHtml(prenom)}, voici votre évaluation bien-être personnalisée par DogShift.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="border-collapse:collapse;width:560px;max-width:560px;">


          <!-- HERO HEADER -->
          <tr>
            <td style="border-radius:16px 16px 0 0;overflow:hidden;background:linear-gradient(135deg,#7c3aed 0%,#6366f1 55%,#818cf8 100%);padding:28px 36px 32px;">
          <!-- Logo inside hero -->
              <div style="margin-bottom:24px;">
                <a href="${siteUrl}" style="text-decoration:none;display:inline-flex;align-items:center;gap:10px;">
                  <img src="${escapeHtml(logoUrl)}" width="32" height="32" alt=""
                    style="display:block;border:0;width:32px;height:32px;border-radius:6px;" />
                  <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:17px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">DogShift</span>
                </a>
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;display:inline-block;background:rgba(255,255,255,0.18);color:rgba(255,255,255,0.95);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:4px 12px;border-radius:20px;margin-bottom:16px;">
                Évaluation bien-être
              </div>
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;line-height:32px;color:#ffffff;letter-spacing:-0.4px;margin-bottom:12px;">
                ${escapeHtml(titre)}
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:rgba(255,255,255,0.85);">
                Bonjour ${escapeHtml(prenom)}, voici votre évaluation personnalisée basée sur vos réponses.
              </div>
            </td>
          </tr>

          <!-- MAIN CARD -->
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 0 0;">

              <!-- Analyse title -->
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6d28d9;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #ede9fe;">
                Votre analyse zoothérapeutique
              </div>

              <!-- Analyse rows -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                ${analyseHtml}
              </table>

              <!-- Divider -->
              <div style="height:1px;background:#f3f4f6;margin:8px 0 20px;"></div>

              <!-- Conseil pratique -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="background:#faf5ff;border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:16px 18px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6d28d9;margin-bottom:6px;">
                      Conseil pratique
                    </div>
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:24px;color:#1e1b4b;">
                      ${escapeHtml(conseil)}
                    </div>
                  </td>
                </tr>
              </table>

              <div style="height:20px;"></div>

              <!-- Conclusion -->
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:24px;color:#374151;font-style:italic;">
                ${escapeHtml(conclusion)}
              </div>

            </td>
          </tr>

          <!-- EMOTIONAL IMAGE BANNER -->
          <tr>
            <td style="padding:0;position:relative;overflow:hidden;">
              <div style="position:relative;background:#1e1b4b;border-radius:0;">
                <img src="${escapeHtml(heroImageUrl)}" width="560" alt="Le lien entre vous et votre chien"
                  style="display:block;width:100%;max-width:560px;height:220px;object-fit:cover;object-position:center 40%;opacity:0.55;border:0;" />
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;position:absolute;top:0;left:0;width:100%;height:100%;">
                  <tr>
                    <td style="padding:32px;vertical-align:middle;">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:400;color:#c4b5fd;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">
                        Ce regard. Cette présence.
                      </div>
                      <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;line-height:30px;color:#ffffff;max-width:340px;">
                        Sans condition.
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:rgba(255,255,255,0.85);margin-top:10px;max-width:340px;">
                        Votre chien vous offre chaque jour quelque chose de rare — prenez-en soin ensemble.
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:28px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="text-align:center;">
                    <center>
                      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:separate;">
                        <tr>
                          <td align="center" bgcolor="#7c3aed" style="border-radius:12px;">
                            <a href="${siteUrl}" style="display:block;background:#7c3aed;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:16px;padding:14px 28px;border-radius:12px;text-align:center;">
                              Découvrir DogShift
                            </a>
                          </td>
                        </tr>
                      </table>
                    </center>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:14px 0 0;text-align:center;">
                    <center>
                      <a href="${searchUrl}" style="color:#6b7280;text-decoration:underline;font-family:Arial,Helvetica,sans-serif;font-size:12px;">
                        Trouver un dog-sitter vérifié
                      </a>
                    </center>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding:20px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:#9ca3af;text-align:center;">
              <center>
                Vous recevez cet email car vous avez participé à l&apos;évaluation bien-être sur
                <a href="${siteUrl}" style="color:#9ca3af;">dogshift.ch</a>.
                DogShift &bull; <a href="mailto:support@dogshift.ch" style="color:#9ca3af;">support@dogshift.ch</a>
              </center>
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
