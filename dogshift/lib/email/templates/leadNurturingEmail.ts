/**
 * Lead nurturing sequence — 3 emails post-capture, style violet identique au leadMagnetEmail.
 *
 * Step 1 (J+1) : rappel guide + premiers sitters
 * Step 2 (J+3) : preuve sociale + comment ça marche
 * Step 3 (J+7) : urgence douce + CTA réservation
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildBase(params: {
  baseUrl: string;
  previewText: string;
  heroLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
  heroImageUrl?: string;
}) {
  const {
    baseUrl,
    previewText,
    heroLabel,
    heroTitle,
    heroSubtitle,
    bodyHtml,
    ctaLabel,
    heroImageUrl,
  } = params;

  const base = (baseUrl || "").trim().replace(/\/$/, "") || "https://dogshift.ch";
  const logoUrl = escapeHtml(`${base}/dogshift-logo.png`);
  const siteUrl = escapeHtml(base);
  const ctaUrl = escapeHtml(params.ctaUrl);
  const secondaryLabel = params.secondaryLabel ? escapeHtml(params.secondaryLabel) : "";
  const secondaryUrl = params.secondaryUrl ? escapeHtml(params.secondaryUrl) : "";
  const imgUrl = heroImageUrl ? escapeHtml(heroImageUrl) : escapeHtml(`${base}/images/zootherapie/zootherapie2.jpg`);

  const secondaryHtml = secondaryLabel && secondaryUrl
    ? `<tr>
        <td align="center" style="padding:12px 0 0;text-align:center;">
          <center>
            <a href="${secondaryUrl}" style="color:#6b7280;text-decoration:underline;font-family:Arial,Helvetica,sans-serif;font-size:12px;">
              ${secondaryLabel}
            </a>
          </center>
        </td>
      </tr>`
    : "";

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(heroTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">${escapeHtml(previewText)}</div>

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

          <!-- HERO -->
          <tr>
            <td style="border-radius:16px 16px 0 0;overflow:hidden;background:linear-gradient(135deg,#4c1d95 0%,#7c3aed 60%,#8b5cf6 100%);padding:36px 32px 32px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c4b5fd;margin-bottom:12px;">
                ${escapeHtml(heroLabel)}
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;line-height:34px;color:#ffffff;margin-bottom:10px;">
                ${escapeHtml(heroTitle)}
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#ddd6fe;">
                ${escapeHtml(heroSubtitle)}
              </div>
            </td>
          </tr>

          <!-- BODY CARD -->
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- IMAGE BANNER -->
          <tr>
            <td style="padding:0;overflow:hidden;">
              <div style="position:relative;background:#1e1b4b;">
                <img src="${imgUrl}" width="560" alt="Votre chien entre de bonnes mains"
                  style="display:block;width:100%;max-width:560px;height:200px;object-fit:cover;object-position:center 35%;opacity:0.45;border:0;" />
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;position:absolute;top:0;left:0;width:100%;height:100%;">
                  <tr>
                    <td style="padding:28px 32px;vertical-align:middle;">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:400;color:#c4b5fd;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">
                        Parce qu&apos;il le mérite.
                      </div>
                      <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;line-height:30px;color:#ffffff;max-width:340px;">
                        Votre chien mérite<br />quelqu&apos;un de confiance.
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
                            <a href="${ctaUrl}" style="display:block;background:#7c3aed;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:16px;padding:14px 28px;border-radius:12px;text-align:center;">
                              ${escapeHtml(ctaLabel)}
                            </a>
                          </td>
                        </tr>
                      </table>
                    </center>
                  </td>
                </tr>
                ${secondaryHtml}
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
                &bull; <a href="${escapeHtml(`${base}/unsubscribe`)}" style="color:#9ca3af;">Se désabonner</a>
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

// ─── Étape 1 (J+1) ────────────────────────────────────────────────────────────
// Rappel du guide + mise en avant des sitters vérifiés

export function renderNurturingStep1(params: { baseUrl: string; prenom?: string }) {
  const base = (params.baseUrl || "").trim().replace(/\/$/, "") || "https://dogshift.ch";
  const searchUrl = `${base}/sitters`;

  const bodyHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6d28d9;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #ede9fe;">
      Vous avez pensé à votre guide ?
    </div>

    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:25px;color:#374151;margin-bottom:20px;">
      ${params.prenom ? `Bonjour ${escapeHtml(params.prenom)},` : "Bonjour,"}<br /><br />
      Hier, vous avez téléchargé notre guide <strong>« Les 5 erreurs à éviter »</strong>. Nous espérons qu'il vous a été utile !<br /><br />
      Si vous cherchez un sitter pour votre chien, sachez que tous les sitters DogShift sont vérifiés manuellement — nous rencontrons chaque candidat avant qu'il soit visible sur la plateforme.
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="background:#faf5ff;border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:16px 18px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6d28d9;margin-bottom:6px;">
            Pourquoi DogShift ?
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
            <tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;">&#x2714;&nbsp; Sitters vérifiés manuellement par notre équipe</td></tr>
            <tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;">&#x2714;&nbsp; Avis réels de propriétaires comme vous</td></tr>
            <tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;">&#x2714;&nbsp; Paiement sécurisé, pas de frais cachés</td></tr>
            <tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;">&#x2714;&nbsp; Support réactif, basé en Suisse romande</td></tr>
          </table>
        </td>
      </tr>
    </table>`;

  return buildBase({
    baseUrl: base,
    previewText: "Avez-vous eu le temps de lire votre guide ? Voici nos sitters disponibles près de chez vous.",
    heroLabel: "Votre guide DogShift",
    heroTitle: "Avez-vous eu le temps de le lire ?",
    heroSubtitle: "Et si vous parliez avec un sitter vérifié aujourd'hui ?",
    bodyHtml,
    ctaLabel: "Voir les sitters disponibles →",
    ctaUrl: searchUrl,
    secondaryLabel: "Relire le guide",
    secondaryUrl: `${base}/guide-dogsitter`,
  });
}

// ─── Étape 2 (J+3) ────────────────────────────────────────────────────────────
// Preuve sociale + comment ça marche

export function renderNurturingStep2(params: { baseUrl: string; prenom?: string }) {
  const base = (params.baseUrl || "").trim().replace(/\/$/, "") || "https://dogshift.ch";
  const searchUrl = `${base}/sitters`;

  const avis = [
    { nom: "Marie L.", note: "★★★★★", texte: "Notre chien était aux petits soins. On a eu des photos tous les soirs — vraiment rassurant !" },
    { nom: "Thomas B.", note: "★★★★★", texte: "Réservation en 2 minutes, sitter ponctuel et attentionné. Je recommande sans hésiter." },
    { nom: "Camille R.", note: "★★★★★", texte: "Notre golden retriever a adoré son séjour. Le sitter connaissait bien les chiens anxieux." },
  ];

  const avisHtml = avis.map(a => `
    <tr>
      <td style="padding:0 0 14px 0;">
        <div style="background:#f5f3ff;border-radius:10px;padding:14px 16px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#111827;margin-bottom:2px;">${escapeHtml(a.nom)} <span style="color:#7c3aed;">${escapeHtml(a.note)}</span></div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:20px;color:#374151;font-style:italic;">&ldquo;${escapeHtml(a.texte)}&rdquo;</div>
        </div>
      </td>
    </tr>`).join("");

  const bodyHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6d28d9;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #ede9fe;">
      Ce que disent nos propriétaires
    </div>

    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:25px;color:#374151;margin-bottom:20px;">
      ${params.prenom ? `${escapeHtml(params.prenom)},` : ""} des centaines de propriétaires en Suisse romande ont déjà confié leur chien via DogShift. Voici ce qu'ils en pensent.
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:20px;">
      ${avisHtml}
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="background:#faf5ff;border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:16px 18px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#1e1b4b;margin-bottom:6px;">Comment ça marche ?</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:22px;color:#374151;">
            <strong>1.</strong> Choisissez votre sitter parmi nos profils vérifiés<br />
            <strong>2.</strong> Réservez en ligne en quelques clics<br />
            <strong>3.</strong> Partez l&apos;esprit tranquille — votre chien est entre de bonnes mains
          </div>
        </td>
      </tr>
    </table>`;

  return buildBase({
    baseUrl: base,
    previewText: "Ce que pensent les autres propriétaires de DogShift — des avis qui parlent d'eux-mêmes.",
    heroLabel: "Ils l'ont fait avant vous",
    heroTitle: "Des propriétaires satisfaits dans toute la Suisse romande",
    heroSubtitle: "Découvrez pourquoi ils nous font confiance pour leur compagnon.",
    bodyHtml,
    ctaLabel: "Trouver mon sitter →",
    ctaUrl: searchUrl,
  });
}

// ─── Étape 3 (J+7) ────────────────────────────────────────────────────────────
// Urgence douce + CTA réservation directe

export function renderNurturingStep3(params: { baseUrl: string; prenom?: string }) {
  const base = (params.baseUrl || "").trim().replace(/\/$/, "") || "https://dogshift.ch";
  const searchUrl = `${base}/sitters`;

  const bodyHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6d28d9;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #ede9fe;">
      Une dernière chose…
    </div>

    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:25px;color:#374151;margin-bottom:20px;">
      ${params.prenom ? `${escapeHtml(params.prenom)},` : ""} depuis que vous avez découvert DogShift, nous n'avons plus de vos nouvelles — et c'est tout à fait normal.<br /><br />
      Mais si vous préparez des vacances, un week-end, ou même juste une longue journée de travail, votre chien mérite un sitter en qui vous avez confiance.<br /><br />
      Nos sitters sont disponibles pour la promenade, la garde à la journée ou la pension. Vous pouvez consulter les profils, lire les avis et réserver en toute liberté — sans engagement.
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
            <tr>
              <td width="33%" style="padding:0 6px 0 0;vertical-align:top;">
                <div style="background:#faf5ff;border-radius:10px;padding:14px;text-align:center;">
                  <div style="font-size:22px;margin-bottom:6px;">🦮</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#6d28d9;">Promenade</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6b7280;margin-top:3px;">1h ou 2h</div>
                </div>
              </td>
              <td width="33%" style="padding:0 3px;vertical-align:top;">
                <div style="background:#faf5ff;border-radius:10px;padding:14px;text-align:center;">
                  <div style="font-size:22px;margin-bottom:6px;">🏠</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#6d28d9;">Garde</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6b7280;margin-top:3px;">À la journée</div>
                </div>
              </td>
              <td width="33%" style="padding:0 0 0 6px;vertical-align:top;">
                <div style="background:#faf5ff;border-radius:10px;padding:14px;text-align:center;">
                  <div style="font-size:22px;margin-bottom:6px;">🌙</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#6d28d9;">Pension</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6b7280;margin-top:3px;">Nuit ou séjour</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="background:#1e1b4b;border-radius:10px;padding:16px 20px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:22px;color:#ddd6fe;text-align:center;">
            Votre chien ne peut pas choisir son sitter.<br />
            <strong style="color:#ffffff;">Vous, vous le pouvez.</strong>
          </div>
        </td>
      </tr>
    </table>`;

  return buildBase({
    baseUrl: base,
    previewText: "Promenade, garde ou pension — votre chien mérite le meilleur sitter. Consultez les profils.",
    heroLabel: "DogShift vous accompagne",
    heroTitle: "Votre chien mérite le meilleur 🐾",
    heroSubtitle: "Promenade, garde à la journée, pension — trouvez le sitter idéal en quelques minutes.",
    bodyHtml,
    ctaLabel: "Voir les sitters disponibles →",
    ctaUrl: searchUrl,
    secondaryLabel: "En savoir plus sur DogShift",
    secondaryUrl: base,
  });
}
