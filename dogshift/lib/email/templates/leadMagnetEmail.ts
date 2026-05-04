/**
 * Lead magnet email — "Les 5 erreurs à éviter".
 * Fully custom HTML template, same visual style as zootherapieEmail.ts
 * (purple/violet gradient hero, section badges, emotional image banner).
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const ERREURS = [
  {
    label: "Erreur #1",
    titre: "Ne pas vérifier les références",
    texte:
      "Un sitter sans avis vérifiés, c'est un inconnu chez vous. Chez DogShift, chaque sitter est contrôlé manuellement avant publication.",
  },
  {
    label: "Erreur #2",
    titre: "Choisir uniquement sur le prix",
    texte:
      "Le tarif le plus bas cache souvent un manque d'expérience. Comparez l'expérience, les reviews et le feeling — pas juste le chiffre.",
  },
  {
    label: "Erreur #3",
    titre: "Sauter la rencontre préalable",
    texte:
      "Votre chien a besoin de valider la personne avant le séjour. Une courte rencontre préalable évite 90 % des mauvaises surprises.",
  },
  {
    label: "Erreur #4",
    titre: "Oublier les infos médicales",
    texte:
      "Allergies, traitements, comportements particuliers — notez tout par écrit. En cas d'urgence, votre sitter doit pouvoir agir vite.",
  },
  {
    label: "Erreur #5",
    titre: "Ne pas définir les routines",
    texte:
      "Heures de repas, balades, interdits... Les chiens sont des créatures d'habitude. Plus votre sitter en sait, plus votre chien sera serein.",
  },
];

export function renderLeadMagnetEmail(params: { baseUrl: string }) {
  const baseUrl = (params.baseUrl || "").trim().replace(/\/$/, "") || "https://dogshift.ch";
  const guideUrl = escapeHtml(`${baseUrl}/guide-dogsitter`);
  const searchUrl = escapeHtml(`${baseUrl}/search`);
  const logoUrl = escapeHtml(`${baseUrl}/dogshift-logo.png`);
  const heroImageUrl = escapeHtml(`${baseUrl}/images/zootherapie/zootherapie2.jpg`);
  const siteUrl = escapeHtml(baseUrl);

  const erreursHtml = ERREURS.map(
    ({ label, titre, texte }) => `
      <tr>
        <td style="padding:0 0 18px 0;">
          <div style="display:inline-block;background:#ede9fe;color:#6d28d9;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:3px 10px;border-radius:20px;margin-bottom:6px;">
            ${escapeHtml(label)}
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#111827;margin-bottom:4px;">
            ${escapeHtml(titre)}
          </div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:22px;color:#374151;">
            ${escapeHtml(texte)}
          </div>
        </td>
      </tr>`
  ).join("");

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Votre guide gratuit est prêt 🐕</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <!-- Preview text -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    Les 5 erreurs à éviter quand vous confiez votre chien — conseils d'experts DogShift.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="border-collapse:collapse;width:560px;max-width:560px;">

          <!-- LOGO -->
          <tr>
            <td align="center" style="padding:0 0 20px 0;">
              <a href="${siteUrl}" style="text-decoration:none;">
                <img src="${logoUrl}" width="44" height="44" alt="DogShift"
                  style="display:inline-block;border:0;width:44px;height:44px;border-radius:12px;vertical-align:middle;margin-right:10px;" />
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#111827;vertical-align:middle;">DogShift</span>
              </a>
            </td>
          </tr>

          <!-- HERO HEADER -->
          <tr>
            <td style="border-radius:16px 16px 0 0;overflow:hidden;background:linear-gradient(135deg,#4c1d95 0%,#7c3aed 60%,#8b5cf6 100%);padding:36px 32px 32px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c4b5fd;margin-bottom:12px;">
                Guide gratuit
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;line-height:34px;color:#ffffff;margin-bottom:10px;">
                Votre guide est prêt 🐕
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#ddd6fe;">
                Les 5 erreurs à éviter quand vous confiez votre chien — pour un séjour serein, en toute confiance.
              </div>
            </td>
          </tr>

          <!-- MAIN CARD -->
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;">

              <!-- Section title -->
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6d28d9;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #ede9fe;">
                Ce que vous allez découvrir
              </div>

              <!-- Erreurs -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                ${erreursHtml}
              </table>

              <!-- Divider -->
              <div style="height:1px;background:#f3f4f6;margin:4px 0 20px;"></div>

              <!-- Conseil clé -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="background:#faf5ff;border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:16px 18px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6d28d9;margin-bottom:6px;">
                      Le conseil DogShift
                    </div>
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:24px;color:#1e1b4b;">
                      Un sitter DogShift est vérifié manuellement, assuré, et formé aux urgences vétérinaires. Confiez votre chien à quelqu&apos;un en qui vous pouvez vraiment avoir confiance.
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- EMOTIONAL IMAGE BANNER -->
          <tr>
            <td style="padding:0;overflow:hidden;">
              <div style="position:relative;background:#1e1b4b;">
                <img src="${heroImageUrl}" width="560" alt="Un chien heureux avec son sitter"
                  style="display:block;width:100%;max-width:560px;height:220px;object-fit:cover;object-position:center 35%;opacity:0.5;border:0;" />
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;position:absolute;top:0;left:0;width:100%;height:100%;">
                  <tr>
                    <td style="padding:32px;vertical-align:middle;">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:400;color:#c4b5fd;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">
                        Parce qu&apos;il le mérite.
                      </div>
                      <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;line-height:30px;color:#ffffff;max-width:340px;">
                        Votre chien mérite<br />quelqu&apos;un de confiance.
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#ddd6fe;margin-top:10px;max-width:340px;">
                        Chaque sitter DogShift est sélectionné avec soin — pour que vous partiez l&apos;esprit tranquille.
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
                            <a href="${guideUrl}" style="display:block;background:#7c3aed;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:16px;padding:14px 28px;border-radius:12px;text-align:center;">
                              Lire le guide complet →
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
                        Trouver un dog-sitter vérifié sur DogShift
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
                Vous recevez cet email car vous avez demandé notre guide gratuit sur
                <a href="${siteUrl}" style="color:#9ca3af;">dogshift.ch</a>.
                DogShift &bull; <a href="mailto:support@dogshift.ch" style="color:#9ca3af;">support@dogshift.ch</a>
                &bull; <a href="${escapeHtml(`${baseUrl}/unsubscribe`)}" style="color:#9ca3af;">Se désabonner</a>
              </center>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text =
    `Votre guide gratuit DogShift est prêt !\n\n` +
    `Les 5 erreurs à éviter quand vous confiez votre chien :\n\n` +
    ERREURS.map((e, i) => `${i + 1}. ${e.titre} — ${e.texte}`).join("\n") +
    `\n\nLire le guide complet : ${baseUrl}/guide-dogsitter\n\n` +
    `— L'équipe DogShift\nsupport@dogshift.ch | ${baseUrl}\n`;

  return { html, text };
}
