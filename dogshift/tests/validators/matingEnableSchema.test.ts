import test from "node:test";
import assert from "node:assert/strict";

import { matingEnableSchema } from "../../lib/validators/breeding.ts";

test("valid enable payload parses with defaults", () => {
  const r = matingEnableSchema.safeParse({ dogProfileId: "dog_1", acceptTerms: true });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.enabled, true);
    assert.equal(r.data.goal, "EXPLORING");
  }
});

test("enabling without accepting the terms is rejected", () => {
  const r = matingEnableSchema.safeParse({ dogProfileId: "dog_1", enabled: true, acceptTerms: false });
  assert.equal(r.success, false);
  if (!r.success) {
    assert.ok(r.error.issues.some((i) => i.path.includes("acceptTerms")));
  }
});

test("disabling (pausing) does NOT require accepting the terms", () => {
  const r = matingEnableSchema.safeParse({ dogProfileId: "dog_1", enabled: false, acceptTerms: false });
  assert.equal(r.success, true);
});

test("bio over 500 chars is rejected", () => {
  const r = matingEnableSchema.safeParse({
    dogProfileId: "dog_1",
    acceptTerms: true,
    bio: "x".repeat(501),
  });
  assert.equal(r.success, false);
});

test("unknown goal is rejected", () => {
  const r = matingEnableSchema.safeParse({ dogProfileId: "dog_1", acceptTerms: true, goal: "WHATEVER" });
  assert.equal(r.success, false);
});
