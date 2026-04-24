import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTIVATION_CODE_ALPHABET,
  ACTIVATION_CODE_BODY_LENGTH,
  ACTIVATION_CODE_TTL_MS,
  computeActivationCodeExpiresAt,
  generateActivationCode,
} from "../../lib/sitterActivationCode.ts";
import { hashActivationCode, normalizeActivationCode } from "../../lib/sitterContract.ts";

// ---------------------------------------------------------------------------
// Alphabet
// ---------------------------------------------------------------------------

test("ACTIVATION_CODE_ALPHABET has exactly 32 characters (power-of-two for unbiased mod)", () => {
  assert.equal(ACTIVATION_CODE_ALPHABET.length, 32);
});

test("ACTIVATION_CODE_ALPHABET excludes visually ambiguous characters 0, O, 1, I", () => {
  for (const forbidden of ["0", "O", "1", "I"]) {
    assert.equal(
      ACTIVATION_CODE_ALPHABET.includes(forbidden),
      false,
      `alphabet should not contain "${forbidden}"`,
    );
  }
});

test("ACTIVATION_CODE_ALPHABET uses only uppercase ASCII letters + digits 2-9", () => {
  for (const ch of ACTIVATION_CODE_ALPHABET) {
    const isUpper = ch >= "A" && ch <= "Z";
    const isDigit29 = ch >= "2" && ch <= "9";
    assert.equal(
      isUpper || isDigit29,
      true,
      `unexpected character in alphabet: ${JSON.stringify(ch)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Code format
// ---------------------------------------------------------------------------

test("generateActivationCode returns DS-XXXX-XXXX format", () => {
  const code = generateActivationCode();
  assert.match(code, /^DS-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test("generateActivationCode body length matches ACTIVATION_CODE_BODY_LENGTH", () => {
  const code = generateActivationCode();
  const body = code.replace(/^DS-/, "").replace("-", "");
  assert.equal(body.length, ACTIVATION_CODE_BODY_LENGTH);
});

test("generateActivationCode draws every character from the readable alphabet", () => {
  const code = generateActivationCode();
  const body = code.replace(/^DS-/, "").replace(/-/g, "");
  for (const ch of body) {
    assert.equal(
      ACTIVATION_CODE_ALPHABET.includes(ch),
      true,
      `character "${ch}" is not in ACTIVATION_CODE_ALPHABET`,
    );
  }
});

test("generateActivationCode never emits 0, O, 1 or I across a large sample", () => {
  const forbidden = new Set(["0", "O", "1", "I"]);
  for (let i = 0; i < 2_000; i += 1) {
    const code = generateActivationCode();
    for (const ch of code) {
      assert.equal(forbidden.has(ch), false, `code ${code} contains forbidden character ${ch}`);
    }
  }
});

test("generateActivationCode produces highly unique codes across a large sample", () => {
  const codes = new Set<string>();
  const samples = 5_000;
  for (let i = 0; i < samples; i += 1) {
    codes.add(generateActivationCode());
  }
  // 32^8 ≈ 1.1e12 — collisions in 5000 draws are astronomically unlikely.
  assert.equal(codes.size, samples);
});

// ---------------------------------------------------------------------------
// Hash alignment with the existing redeem endpoint
// ---------------------------------------------------------------------------

test("hashActivationCode is stable across whitespace / case variants", () => {
  const canonical = "DS-AB2C-D3EF";
  const baseHash = hashActivationCode(canonical);
  assert.equal(hashActivationCode("  ds-ab2c-d3ef  "), baseHash);
  assert.equal(hashActivationCode("Ds-Ab2C-d3Ef"), baseHash);
});

test("normalizeActivationCode uppercases and strips whitespace", () => {
  assert.equal(normalizeActivationCode("  ds-ab2c-d3ef  "), "DS-AB2C-D3EF");
});

// ---------------------------------------------------------------------------
// TTL
// ---------------------------------------------------------------------------

test("ACTIVATION_CODE_TTL_MS defaults to 7 days", () => {
  // The module reads SITTER_ACTIVATION_CODE_TTL_DAYS at load time. In the test
  // environment we don't set it, so we expect the spec default of 7 days.
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  assert.equal(ACTIVATION_CODE_TTL_MS, sevenDaysMs);
});

test("computeActivationCodeExpiresAt adds exactly the TTL to the issuedAt instant", () => {
  const issuedAt = new Date("2026-04-24T10:00:00.000Z");
  const expiresAt = computeActivationCodeExpiresAt(issuedAt);
  assert.equal(expiresAt.getTime() - issuedAt.getTime(), ACTIVATION_CODE_TTL_MS);
});
