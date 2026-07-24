import { renderEmailLayout, type EmailSummaryRow } from "./templates/layout";
import { reportChecklistLines } from "../serviceReport/checklist";

export { reportChecklistLines };

/** Report shape consumed by the email (subset of ServiceReport). */
export type ReportEmailData = {
  note: string | null;
  peed: boolean | null;
  pooed: boolean | null;
  drankWater: boolean | null;
  ate: boolean | null;
  played: boolean | null;
  mood: string | null;
  energy: number | null;
  incidents: string | null;
  distanceMeters: number | null;
};

function esc(v: string): string {
  return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function photosHtml(photoUrls: string[]): string {
  if (photoUrls.length === 0) return "";
  const cells = photoUrls
    .slice(0, 8)
    .map(
      (u) =>
        `<td style="padding:4px;width:50%;"><img src="${esc(u)}" alt="Photo" width="260" style="width:100%;max-width:260px;border-radius:12px;display:block;" /></td>`,
    );
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td style="width:50%;"></td>'}</tr>`);
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0;"><tbody>${rows.join("")}</tbody></table>`;
}

function checklistHtml(lines: string[]): string {
  if (lines.length === 0) return "";
  const items = lines
    .map((l) => `<li style="margin:4px 0;color:#334155;font-size:14px;">${esc(l)}</li>`)
    .join("");
  return `<p style="margin:14px 0 4px;font-weight:700;color:#0f172a;font-size:14px;">Le déroulé</p><ul style="margin:0;padding-left:20px;">${items}</ul>`;
}

/**
 * Build the owner-facing "rapport de service" email. `photoUrls` must be
 * directly-fetchable (presigned R2 GET) URLs so email clients render them.
 */
export function buildServiceReportEmail(params: {
  dogName: string | null;
  sitterName: string | null;
  serviceLabel: string;
  dateLabel: string;
  report: ReportEmailData;
  photoUrls: string[];
  /** Optional server-rendered route-map image (see lib/serviceReport/routeStaticMap). */
  routeMapUrl?: string | null;
  reportUrl: string;
  baseUrl: string;
}): { subject: string; html: string; text: string } {
  const { dogName, sitterName, serviceLabel, dateLabel, report, photoUrls, routeMapUrl, reportUrl, baseUrl } = params;
  const dog = dogName || "Ton chien";
  const sitter = sitterName || "Ton dogsitter";

  const summaryRows: EmailSummaryRow[] = [{ label: "Service", value: serviceLabel }, { label: "Quand", value: dateLabel }];
  if (typeof report.distanceMeters === "number" && report.distanceMeters > 0) {
    summaryRows.push({ label: "Distance", value: `${(report.distanceMeters / 1000).toFixed(2)} km` });
  }

  const lines = reportChecklistLines(report);
  const noteHtml = report.note
    ? `<p style="margin:14px 0 4px;font-weight:700;color:#0f172a;font-size:14px;">Le mot de ${esc(sitter)}</p><p style="margin:0;color:#334155;font-size:14px;line-height:1.5;">${esc(report.note)}</p>`
    : "";
  const incidentsHtml = report.incidents
    ? `<p style="margin:14px 0 4px;font-weight:700;color:#b45309;font-size:14px;">À signaler</p><p style="margin:0;color:#92400e;font-size:14px;line-height:1.5;">${esc(report.incidents)}</p>`
    : "";

  const routeHtml = routeMapUrl
    ? `<img src="${esc(routeMapUrl)}" alt="Parcours de la balade" width="516" style="width:100%;max-width:516px;border-radius:12px;display:block;margin:8px 0;" />`
    : "";

  const extraHtml = `${photosHtml(photoUrls)}${routeHtml}${checklistHtml(lines)}${noteHtml}${incidentsHtml}`;

  const { html } = renderEmailLayout({
    logoUrl: `${baseUrl}/dogshift-logo.png`,
    audience: "owner",
    heroLabel: "RAPPORT DE SERVICE",
    title: `${dog} a passé un super moment`,
    subtitle: `Le rapport de ${sitter}`,
    summaryRows,
    extraHtml,
    ctaLabel: "Voir le rapport",
    ctaUrl: reportUrl,
    baseUrl,
  });

  const textLines = [
    `Rapport de service — ${dog}`,
    `${serviceLabel} · ${dateLabel}`,
    ...lines,
    report.note ? `\nMot de ${sitter} : ${report.note}` : "",
    report.incidents ? `\nÀ signaler : ${report.incidents}` : "",
    `\nVoir le rapport : ${reportUrl}`,
  ].filter(Boolean);

  return { subject: `Rapport de service — ${dog}`, html, text: textLines.join("\n") };
}
