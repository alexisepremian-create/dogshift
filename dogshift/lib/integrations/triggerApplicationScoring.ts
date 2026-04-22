/**
 * Fire-and-forget integration that pushes a freshly created sitter
 * application to the external n8n scoring workflow.
 *
 * The n8n workflow:
 *  1. Receives this payload on a Webhook node.
 *  2. Computes a score + decision (HIGH / REVIEW / LOW) in a Code node.
 *  3. Routes to our own /api/emails/send-application-email route which
 *     sends the branded follow-up email to the candidate.
 *
 * This module MUST never throw — a failing integration must never block
 * candidate creation.
 */

// Mirrors exactly the field names the n8n Code node reads from
// `$input.first().json.body`. Keep in sync with the scoring script.
export type ApplicationScoringPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  cityOther: string | null;
  npa: string | null;
  linkAnimalProfession: string | null;
  linkAnimalProfessionOther: string | null;
  gardeExperienceLevel: string | null;
  experience: string;
  motivation: string;
  availabilityStructured:
    | Record<
        string,
        { matin: boolean; apresMidi: boolean; journeeEntiere: boolean }
      >
    | null;
  gardeTypes: string[];
  dogSizes: string[];
  housingType: string | null;
  hasCarLicense: boolean | null;
  applicationId: string;
};

export type BuildApplicationScoringPayloadInput = {
  applicationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  cityOther: string | null;
  npa: string | null;
  linkAnimalProfession: string | null;
  linkAnimalProfessionOther: string | null;
  gardeExperienceLevel: string | null;
  experienceText: string;
  motivationText: string;
  availabilityStructured:
    | Record<
        string,
        { matin: boolean; apresMidi: boolean; journeeEntiere: boolean }
      >
    | null;
  gardeTypes: string[];
  dogSizes: string[];
  housingType: string | null;
  hasCarLicense: boolean | null;
};

export function buildApplicationScoringPayload(
  input: BuildApplicationScoringPayloadInput,
): ApplicationScoringPayload {
  return {
    applicationId: input.applicationId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    city: input.city,
    cityOther: input.cityOther,
    npa: input.npa,
    linkAnimalProfession: input.linkAnimalProfession,
    linkAnimalProfessionOther: input.linkAnimalProfessionOther,
    gardeExperienceLevel: input.gardeExperienceLevel,
    // n8n scoring script expects the field names `experience` and
    // `motivation`, not the canonical DB names.
    experience: input.experienceText,
    motivation: input.motivationText,
    availabilityStructured: input.availabilityStructured,
    gardeTypes: input.gardeTypes,
    dogSizes: input.dogSizes,
    housingType: input.housingType,
    hasCarLicense: input.hasCarLicense,
  };
}

const DEFAULT_TIMEOUT_MS = 5_000;

export type TriggerApplicationScoringResult =
  | { ok: true; status: number }
  | { ok: false; reason: "disabled" | "network" | "http" | "timeout"; detail?: string };

/**
 * POSTs the payload to the configured n8n webhook. Resolves with a
 * structured result; never rejects. Caller SHOULD log the result but
 * MUST NOT fail the request on a non-ok outcome.
 */
export async function triggerApplicationScoring(
  payload: ApplicationScoringPayload,
  options?: { webhookUrl?: string; timeoutMs?: number },
): Promise<TriggerApplicationScoringResult> {
  const webhookUrl =
    (options?.webhookUrl ?? process.env.N8N_APPLICATION_WEBHOOK_URL ?? "").trim();

  if (!webhookUrl) {
    return { ok: false, reason: "disabled", detail: "N8N_APPLICATION_WEBHOOK_URL not set" };
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        ok: false,
        reason: "http",
        detail: `${res.status} ${res.statusText}`,
      };
    }

    return { ok: true, status: res.status };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return {
      ok: false,
      reason: "network",
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
