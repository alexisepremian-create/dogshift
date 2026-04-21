import test from "node:test";
import assert from "node:assert/strict";

import {
  clerkErrorMessage,
  clerkErrorCode,
  sanitizeVerificationCode,
} from "../../lib/auth/clerkErrorMessage.ts";
import { apiErrorMessage } from "../../lib/errors/apiErrorMessage.ts";

// These helpers are the last line of defense against English / raw-code error
// leaks into the UI (the "VALIDATION_ERROR", "SAVE_ERROR", "form_code_incorrect"
// style strings that users shouldn't ever see). Locking their behaviour here
// means any regression surfaces in CI instead of a user DM.

test("clerkErrorMessage: maps form_code_incorrect to French guidance", () => {
  const err = {
    clerkError: true,
    errors: [{ code: "form_code_incorrect", message: "Incorrect code" }],
  };
  const msg = clerkErrorMessage(err);
  assert.match(msg, /Code incorrect/i);
  assert.match(msg, /dernier code/i); // hints that older codes don't work
});

test("clerkErrorMessage: maps verification_expired to French guidance", () => {
  const err = {
    clerkError: true,
    errors: [{ code: "verification_expired", message: "Code expired" }],
  };
  const msg = clerkErrorMessage(err);
  assert.match(msg, /expiré/i);
  assert.match(msg, /nouveau code/i);
});

test("clerkErrorMessage: falls back to longMessage (already in French via frFR)", () => {
  const err = {
    clerkError: true,
    errors: [
      {
        code: "some_unknown_code",
        message: "short",
        longMessage: "Message détaillé en français venant de Clerk",
      },
    ],
  };
  assert.equal(
    clerkErrorMessage(err),
    "Message détaillé en français venant de Clerk",
  );
});

test("clerkErrorMessage: rejects leaky ALL_CAPS raw codes from generic Error", () => {
  const err = new Error("SAVE_ERROR");
  const msg = clerkErrorMessage(err, "fallback français");
  assert.equal(msg, "fallback français");
});

test("clerkErrorMessage: handles plain network failures with a friendly French message", () => {
  const err = new TypeError("Failed to fetch");
  const msg = clerkErrorMessage(err);
  assert.match(msg, /connexion/i);
});

test("clerkErrorMessage: returns fallback for null/undefined", () => {
  assert.equal(clerkErrorMessage(null, "fb"), "fb");
  assert.equal(clerkErrorMessage(undefined, "fb"), "fb");
});

test("clerkErrorCode: pulls first code out of the errors array", () => {
  const err = {
    clerkError: true,
    errors: [{ code: "form_code_incorrect" }],
  };
  assert.equal(clerkErrorCode(err), "form_code_incorrect");
});

test("clerkErrorCode: returns undefined when no structure", () => {
  assert.equal(clerkErrorCode(new Error("boom")), undefined);
  assert.equal(clerkErrorCode(null), undefined);
});

test("sanitizeVerificationCode: strips all non-digit characters", () => {
  // Invisible whitespace from Gmail/Outlook copy-paste is the #1 reported cause
  // of "code invalide" — this test locks in the fix.
  assert.equal(sanitizeVerificationCode(" 123 456 "), "123456");
  assert.equal(sanitizeVerificationCode("123-456"), "123456");
  assert.equal(sanitizeVerificationCode("\u200B123456\u00A0"), "123456");
  assert.equal(sanitizeVerificationCode("abc123def456"), "123456");
  assert.equal(sanitizeVerificationCode(""), "");
});

test("apiErrorMessage: maps SAVE_ERROR / RESET_ERROR / FETCH_FAILED to French", () => {
  assert.match(apiErrorMessage("SAVE_ERROR"), /enregistrer/i);
  assert.match(apiErrorMessage("RESET_ERROR"), /réinitialiser/i);
  assert.match(apiErrorMessage("FETCH_FAILED"), /récupérer/i);
});

test("apiErrorMessage: maps PRICING_REQUIRED to the detailed French guidance", () => {
  const msg = apiErrorMessage("PRICING_REQUIRED");
  assert.match(msg, /tarif/i);
  assert.match(msg, /Services & tarifs/);
});

test("apiErrorMessage: does not leak unknown ALL_CAPS codes to users", () => {
  // "DOGSHIFT_PANIC" isn't in the map — user must NOT see it raw.
  const msg = apiErrorMessage("DOGSHIFT_PANIC", "fb fr");
  assert.equal(msg, "fb fr");
});

test("apiErrorMessage: passes through already-human sentences untouched", () => {
  const msg = apiErrorMessage("Le tarif doit être compris entre 15 et 25 CHF.");
  assert.equal(msg, "Le tarif doit être compris entre 15 et 25 CHF.");
});

test("apiErrorMessage: falls back to generic French on null/undefined", () => {
  assert.match(apiErrorMessage(null), /erreur/i);
  assert.match(apiErrorMessage(undefined), /erreur/i);
});
