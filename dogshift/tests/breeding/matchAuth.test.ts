import test from "node:test";
import assert from "node:assert/strict";

import { isMatchParticipant, otherSide, previewOf } from "../../lib/breeding/matchAuth.ts";

const match = { dogA: { userId: "u_a", tag: "A" }, dogB: { userId: "u_b", tag: "B" } };

test("isMatchParticipant only for the two owners", () => {
  assert.equal(isMatchParticipant(match, "u_a"), true);
  assert.equal(isMatchParticipant(match, "u_b"), true);
  assert.equal(isMatchParticipant(match, "u_x"), false);
});

test("otherSide returns the counterpart", () => {
  assert.equal(otherSide(match, "u_a").tag, "B");
  assert.equal(otherSide(match, "u_b").tag, "A");
});

test("previewOf collapses whitespace and truncates with an ellipsis", () => {
  assert.equal(previewOf("  hello   world  "), "hello world");
  const long = "a".repeat(100);
  const p = previewOf(long, 80);
  assert.equal(p.length, 80);
  assert.ok(p.endsWith("…"));
});
