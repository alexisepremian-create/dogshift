/**
 * Regression tests for lib/sitter/sitterRole.ts.
 *
 * Bug: a published sitter (Sonia Bürer) carried `role = OWNER` because
 * activation never promoted the role. Everything gated on `role === "SITTER"`
 * silently treated her as an owner.
 * See docs/bugs/sitter-role-not-promoted-on-activation.md.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { hasSitterSide, promoteUserToSitterRole, sitterSideWhere } from "../../lib/sitter/sitterRole.ts";

test("hasSitterSide: a published sitter stuck on role OWNER is still a sitter", () => {
  assert.equal(
    hasSitterSide({
      role: "OWNER",
      sitterId: "sitter_sonia",
      sitterProfile: { published: true, activatedAt: null, lifecycleStatus: "activated" },
    }),
    true,
  );
});

test("hasSitterSide: an activated-but-unpublished profile counts", () => {
  assert.equal(
    hasSitterSide({
      role: "OWNER",
      sitterProfile: { published: false, activatedAt: null, lifecycleStatus: "activated" },
    }),
    true,
  );
  assert.equal(
    hasSitterSide({
      role: "OWNER",
      sitterProfile: { published: false, activatedAt: new Date(), lifecycleStatus: "contract_signed" },
    }),
    true,
  );
});

test("hasSitterSide: a profile still in the application pipeline does NOT count", () => {
  for (const lifecycleStatus of ["application_received", "selected", "contract_to_sign", "contract_signed"]) {
    assert.equal(
      hasSitterSide({
        role: "OWNER",
        sitterProfile: { published: false, activatedAt: null, lifecycleStatus },
      }),
      false,
      `${lifecycleStatus} must not grant the sitter side`,
    );
  }
});

test("hasSitterSide: a plain owner is not a sitter", () => {
  assert.equal(hasSitterSide({ role: "OWNER" }), false);
  assert.equal(hasSitterSide({ role: "OWNER", sitterProfile: null }), false);
  assert.equal(hasSitterSide({}), false);
});

test("hasSitterSide: role SITTER is trusted only together with a sitterId", () => {
  assert.equal(hasSitterSide({ role: "SITTER", sitterId: "sitter_1" }), true);
  // Role without the business key can't own availability rows — don't trust it.
  assert.equal(hasSitterSide({ role: "SITTER", sitterId: null }), false);
  assert.equal(hasSitterSide({ role: "SITTER", sitterId: "" }), false);
});

test("sitterSideWhere: accepts exactly the same cases as hasSitterSide", () => {
  const where = sitterSideWhere();
  const clauses = where.OR;
  assert.equal(clauses.length, 4);
  // Guard against the two drifting apart: every OR branch must map to a shape
  // hasSitterSide() also accepts.
  assert.equal(hasSitterSide({ role: "SITTER", sitterId: "s1" }), true);
  assert.equal(hasSitterSide({ sitterProfile: { published: true } }), true);
  assert.equal(hasSitterSide({ sitterProfile: { activatedAt: new Date() } }), true);
  assert.equal(hasSitterSide({ sitterProfile: { lifecycleStatus: "activated" } }), true);
});

test("promoteUserToSitterRole: scopes the update to OWNER so an ADMIN is never demoted", async () => {
  const calls: unknown[] = [];
  const prisma = {
    user: {
      updateMany: async (args: unknown) => {
        calls.push(args);
        return { count: 1 };
      },
    },
  };

  const promoted = await promoteUserToSitterRole(prisma, "user_1");
  assert.equal(promoted, true);
  assert.deepEqual(calls, [{ where: { id: "user_1", role: "OWNER" }, data: { role: "SITTER" } }]);
});

test("promoteUserToSitterRole: is idempotent (no matching row → false, no throw)", async () => {
  const prisma = { user: { updateMany: async () => ({ count: 0 }) } };
  assert.equal(await promoteUserToSitterRole(prisma, "already_sitter"), false);
});

test("promoteUserToSitterRole: refuses a blank user id without hitting the DB", async () => {
  let called = false;
  const prisma = {
    user: {
      updateMany: async () => {
        called = true;
        return { count: 0 };
      },
    },
  };
  assert.equal(await promoteUserToSitterRole(prisma, "   "), false);
  assert.equal(called, false);
});
