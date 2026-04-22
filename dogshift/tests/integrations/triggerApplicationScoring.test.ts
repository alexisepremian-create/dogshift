import test from "node:test";
import assert from "node:assert/strict";

import {
  buildApplicationScoringPayload,
  triggerApplicationScoring,
} from "../../lib/integrations/triggerApplicationScoring.ts";

// ---------------------------------------------------------------------------
// buildApplicationScoringPayload
// ---------------------------------------------------------------------------

test("buildApplicationScoringPayload renames experienceText/motivationText to match n8n script", () => {
  const payload = buildApplicationScoringPayload({
    applicationId: "app_123",
    firstName: "Alex",
    lastName: "Dupont",
    email: "alex@example.com",
    phone: "+41791234567",
    city: "Lausanne",
    cityOther: null,
    npa: "1003",
    linkAnimalProfession: "Vétérinaire / médecin vétérinaire",
    linkAnimalProfessionOther: null,
    gardeExperienceLevel: "Régulièrement, 1 à 3 ans",
    experienceText: "J'ai gardé plusieurs chiens pour mes voisins",
    motivationText: "Passion pour les animaux, projet long terme",
    availabilityStructured: null,
    gardeTypes: ["Promenade", "Garde"],
    dogSizes: ["Petit", "Moyen"],
    housingType: "Appartement",
    hasCarLicense: true,
  });

  assert.equal(payload.applicationId, "app_123");
  assert.equal(payload.firstName, "Alex");
  assert.equal(payload.experience, "J'ai gardé plusieurs chiens pour mes voisins");
  assert.equal(payload.motivation, "Passion pour les animaux, projet long terme");
  assert.equal(payload.hasCarLicense, true);
  assert.deepEqual(payload.gardeTypes, ["Promenade", "Garde"]);
  // Canonical field names used by the form DB must NOT leak downstream.
  assert.equal((payload as unknown as Record<string, unknown>).experienceText, undefined);
  assert.equal((payload as unknown as Record<string, unknown>).motivationText, undefined);
});

test("buildApplicationScoringPayload preserves nullable fields as null", () => {
  const payload = buildApplicationScoringPayload({
    applicationId: "app_nulls",
    firstName: "A",
    lastName: "B",
    email: "a@b.ch",
    phone: "+41790000000",
    city: "Autre",
    cityOther: "Morges",
    npa: null,
    linkAnimalProfession: null,
    linkAnimalProfessionOther: null,
    gardeExperienceLevel: null,
    experienceText: "",
    motivationText: "",
    availabilityStructured: null,
    gardeTypes: [],
    dogSizes: [],
    housingType: null,
    hasCarLicense: null,
  });

  assert.equal(payload.npa, null);
  assert.equal(payload.linkAnimalProfession, null);
  assert.equal(payload.gardeExperienceLevel, null);
  assert.equal(payload.housingType, null);
  assert.equal(payload.hasCarLicense, null);
  assert.equal(payload.cityOther, "Morges");
  assert.deepEqual(payload.gardeTypes, []);
});

// ---------------------------------------------------------------------------
// triggerApplicationScoring
// ---------------------------------------------------------------------------

const basePayload = buildApplicationScoringPayload({
  applicationId: "app_xyz",
  firstName: "Zoé",
  lastName: "Test",
  email: "zoe@example.ch",
  phone: "+41791112233",
  city: "Lausanne",
  cityOther: null,
  npa: "1003",
  linkAnimalProfession: null,
  linkAnimalProfessionOther: null,
  gardeExperienceLevel: null,
  experienceText: "texte",
  motivationText: "motiv",
  availabilityStructured: null,
  gardeTypes: [],
  dogSizes: [],
  housingType: null,
  hasCarLicense: null,
});

test("triggerApplicationScoring returns disabled when no webhook URL", async () => {
  const result = await triggerApplicationScoring(basePayload, { webhookUrl: "" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "disabled");
  }
});

test("triggerApplicationScoring POSTs JSON body to the configured URL", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedBody = "";
  let capturedHeaders: Record<string, string> = {};

  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    capturedBody = typeof init?.body === "string" ? init.body : "";
    const headers = init?.headers;
    if (headers && typeof headers === "object" && !Array.isArray(headers)) {
      capturedHeaders = headers as Record<string, string>;
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await triggerApplicationScoring(basePayload, {
      webhookUrl: "https://example.test/webhook/abc",
    });
    assert.equal(result.ok, true);
    assert.equal(capturedUrl, "https://example.test/webhook/abc");
    assert.equal(capturedHeaders["Content-Type"], "application/json");
    const parsed = JSON.parse(capturedBody) as { email: string; experience: string };
    assert.equal(parsed.email, "zoe@example.ch");
    assert.equal(parsed.experience, "texte");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("triggerApplicationScoring surfaces http failures as { ok:false, reason:'http' }", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("boom", { status: 500, statusText: "Internal Server Error" })) as typeof fetch;

  try {
    const result = await triggerApplicationScoring(basePayload, {
      webhookUrl: "https://example.test/webhook/abc",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "http");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("triggerApplicationScoring never throws on fetch exception", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;

  try {
    const result = await triggerApplicationScoring(basePayload, {
      webhookUrl: "https://example.test/webhook/abc",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "network");
      assert.ok(result.detail?.includes("ECONNREFUSED"));
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
