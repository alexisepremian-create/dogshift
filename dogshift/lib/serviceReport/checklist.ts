// Pure FR checklist rendering for the service report. `node --test` safe (no @/ imports).

/** Subset of a report needed to render the human-readable checklist. */
export type ReportChecklistData = {
  peed: boolean | null;
  pooed: boolean | null;
  drankWater: boolean | null;
  ate: boolean | null;
  played: boolean | null;
  mood: string | null;
  energy: number | null;
};

export const MOOD_LABELS: Record<string, string> = {
  HAPPY: "Heureux",
  CALM: "Calme",
  TIRED: "Fatigué",
  PLAYFUL: "Joueur",
  ANXIOUS: "Anxieux",
};

/** Human-readable FR lines for the done checklist items (pure, testable). */
export function reportChecklistLines(r: ReportChecklistData): string[] {
  const lines: string[] = [];
  if (r.peed) lines.push("A fait pipi");
  if (r.pooed) lines.push("A fait caca");
  if (r.drankWater) lines.push("A bu de l'eau");
  if (r.ate) lines.push("A mangé");
  if (r.played) lines.push("A joué / câlins");
  if (r.mood && MOOD_LABELS[r.mood]) lines.push(`Humeur : ${MOOD_LABELS[r.mood]}`);
  if (typeof r.energy === "number") lines.push(`Énergie : ${r.energy}/5`);
  return lines;
}
