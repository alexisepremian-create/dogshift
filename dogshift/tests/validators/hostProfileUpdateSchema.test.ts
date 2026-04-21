import test from "node:test";
import assert from "node:assert/strict";

import { hostProfileUpdateSchema } from "../../lib/validators/sitter.ts";

// These tests lock in the lax validation stance that unblocked Sydney/Nathalie
// in prod (see PR #13 / fix/host-profile-save-and-onboarding-step2).
//
// The host profile payload roundtrips existing records — a strict schema that
// rejects legacy avatar values would block their own saves even though the
// API route already ignores invalid avatar values at write time. Every test
// here protects a real regression we hit; do NOT re-tighten the schema without
// first moving those write-side safeguards into the client too.

test("hostProfileUpdateSchema: accepts a legacy base64 avatarDataUrl > 150k chars", () => {
  // Sitters onboarded before R2 uploads have a full-size base64 photo stored
  // in hostProfileJson.avatarDataUrl. The previous 150_000 cap rejected their
  // saves with VALIDATION_ERROR.
  const bigDataUrl = `data:image/jpeg;base64,${"A".repeat(300_000)}`;
  const res = hostProfileUpdateSchema.safeParse({
    firstName: "Sydney",
    avatarDataUrl: bigDataUrl,
  });
  assert.equal(res.success, true, res.success ? "" : JSON.stringify(res.error.issues));
});

test("hostProfileUpdateSchema: accepts a legacy cloud avatarUrl that is not an /api/media path", () => {
  // Some legacy profiles stored a Cloudinary/R2 public URL directly in
  // avatarUrl. The previous strict `.refine()` rejected these; the API already
  // only writes the column when the path matches the persisted media format.
  const res = hostProfileUpdateSchema.safeParse({
    firstName: "Sydney",
    avatarUrl: "https://cdn.example.com/some-legacy-avatar.jpg",
  });
  assert.equal(res.success, true, res.success ? "" : JSON.stringify(res.error.issues));
});

test("hostProfileUpdateSchema: accepts the new /api/media/sitter-avatar/... format too", () => {
  const res = hostProfileUpdateSchema.safeParse({
    avatarUrl: "/api/media/sitter-avatar/abc123token",
  });
  assert.equal(res.success, true, res.success ? "" : JSON.stringify(res.error.issues));
});

test("hostProfileUpdateSchema: accepts null / empty avatar fields", () => {
  const res = hostProfileUpdateSchema.safeParse({
    avatarUrl: null,
    avatarDataUrl: "",
  });
  assert.equal(res.success, true, res.success ? "" : JSON.stringify(res.error.issues));
});

test("hostProfileUpdateSchema: accepts a full realistic profile payload", () => {
  const res = hostProfileUpdateSchema.safeParse({
    profileVersion: 1,
    sitterId: "s-1700000000-abc",
    firstName: "Sydney",
    city: "Genève",
    postalCode: "1201",
    bio: "Cat and dog sitter avec 5 ans d'expérience.",
    services: { Promenade: true, Garde: true, Pension: false },
    pricing: { Promenade: 20, Garde: 25, Pension: null },
    dogSizes: { Petit: true, Moyen: true, Grand: false },
    cancellationFlexible: true,
    verificationStatus: "pending",
    listingStatus: "draft",
    updatedAt: new Date().toISOString(),
    published: false,
  });
  assert.equal(res.success, true, res.success ? "" : JSON.stringify(res.error.issues));
});

test("hostProfileUpdateSchema: rejects non-positive pricing (0 or negative)", () => {
  // Hard business rule: a price of 0 or negative is never valid — the server
  // otherwise would surface it as an enabled service with a broken tariff.
  const res = hostProfileUpdateSchema.safeParse({
    pricing: { Promenade: 0 },
  });
  assert.equal(res.success, false);
});

test("hostProfileUpdateSchema: rejects non-boolean values in services", () => {
  const res = hostProfileUpdateSchema.safeParse({
    services: { Promenade: "yes" as unknown as boolean },
  });
  assert.equal(res.success, false);
});
