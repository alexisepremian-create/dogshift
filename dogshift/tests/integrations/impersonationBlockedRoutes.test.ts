import { test } from "node:test";
import assert from "node:assert/strict";

import {
  IMPERSONATION_BLOCKED_ROUTES,
  isBlockedInImpersonation,
} from "../../lib/auth/impersonation.ts";

// Locks the contract of which side-effects are forbidden while an admin is
// impersonating another user. Every entry has explicit "lecture + actions
// safe" reasoning (see plan): we block anything that would create reputation,
// move money, fire a notification, or change identity/auth.
//
// If any of these flips to `false`, you are letting an admin trigger a side
// effect in someone else's name — RGPD/nLPD risk + trust hit. Push back hard
// in code review.

test("messaging POSTs are blocked", () => {
  assert.equal(isBlockedInImpersonation("POST", "/api/account/messages/conversations/start"), true);
  assert.equal(isBlockedInImpersonation("POST", "/api/account/messages/conversations/conv_123/messages"), true);
  assert.equal(isBlockedInImpersonation("POST", "/api/host/messages/conversations/start"), true);
});

test("Stripe routes are blocked (any method)", () => {
  assert.equal(isBlockedInImpersonation("POST", "/api/stripe/checkout"), true);
  assert.equal(isBlockedInImpersonation("POST", "/api/stripe/payment-intent"), true);
  assert.equal(isBlockedInImpersonation("POST", "/api/host/stripe/connect/create"), true);
  assert.equal(isBlockedInImpersonation("GET", "/api/host/stripe/connect/link"), true);
});

test("Account deletion is blocked", () => {
  assert.equal(isBlockedInImpersonation("POST", "/api/account/delete"), true);
});

test("all DELETE methods are blocked", () => {
  assert.equal(isBlockedInImpersonation("DELETE", "/api/foo/bar"), true);
  assert.equal(isBlockedInImpersonation("DELETE", "/api/host/profile/avatar"), true);
});

test("booking actions are blocked", () => {
  assert.equal(isBlockedInImpersonation("POST", "/api/bookings"), true);
  assert.equal(isBlockedInImpersonation("POST", "/api/host/requests/req_abc/accept"), true);
  assert.equal(isBlockedInImpersonation("POST", "/api/host/requests/req_abc/decline"), true);
  assert.equal(isBlockedInImpersonation("POST", "/api/account/bookings/bk_123/cancel"), true);
});

test("password and email-verif actions are blocked", () => {
  assert.equal(isBlockedInImpersonation("POST", "/api/auth/set-password"), true);
  assert.equal(isBlockedInImpersonation("POST", "/api/auth/reset-password"), true);
  assert.equal(isBlockedInImpersonation("POST", "/api/auth/forgot-password"), true);
  assert.equal(isBlockedInImpersonation("POST", "/api/account/email-verification/send"), true);
});

test("reviews are blocked", () => {
  assert.equal(isBlockedInImpersonation("POST", "/api/reviews"), true);
});

test("all GETs are allowed (read-only is always safe)", () => {
  assert.equal(isBlockedInImpersonation("GET", "/api/account/bookings"), false);
  assert.equal(isBlockedInImpersonation("GET", "/api/host/profile"), false);
  assert.equal(isBlockedInImpersonation("GET", "/api/host/messages/conversations"), false);
});

test("profile edits (POST) are allowed — these are the points we WANT to test as the user", () => {
  // Profile / availability / pricing / avatar saves stay enabled so the admin
  // can reproduce "I can't save" bugs and exercise the same code paths the
  // user does.
  assert.equal(isBlockedInImpersonation("POST", "/api/host/profile"), false);
  assert.equal(isBlockedInImpersonation("POST", "/api/host/profile/pricing"), false);
  assert.equal(isBlockedInImpersonation("POST", "/api/sitters/me/availability-rules"), false);
});

test("contract amendment + terms acceptance allowed (so admin can unblock the Sonia-class bug)", () => {
  // This is intentional — when impersonating Sonia, clicking "J'accepte les
  // conditions" should actually work so we can confirm the unblock end-to-end.
  // These endpoints don't trigger payments or messages; they only flip flags
  // on the impersonated user's own profile. AuditLog already tells us who
  // clicked.
  assert.equal(isBlockedInImpersonation("POST", "/api/host/accept-terms"), false);
  assert.equal(isBlockedInImpersonation("POST", "/api/host/accept-compliance"), false);
  assert.equal(isBlockedInImpersonation("POST", "/api/host/contract-amendment/accept"), false);
});

test("the blocked list covers the four pillars (messages, money, deletion, auth)", () => {
  // High-level invariant — easy to read in CI logs if a refactor reshuffles
  // the array.
  const patterns = IMPERSONATION_BLOCKED_ROUTES.map((r) => r.pattern.source);
  assert.ok(patterns.some((p) => p.includes("messages")), "must block messages");
  assert.ok(patterns.some((p) => p.includes("stripe")), "must block Stripe");
  assert.ok(patterns.some((p) => p.includes("delete")), "must block deletion");
  assert.ok(patterns.some((p) => p.includes("set-password")), "must block password changes");
});
