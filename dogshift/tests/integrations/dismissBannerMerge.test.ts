import { test } from "node:test";
import assert from "node:assert/strict";

import { applyBannerDismissal, readDismissedBanners } from "../../lib/hostBannerDismissal.ts";

// The onboarding banners are now dismissed permanently server-side (inside
// User.hostProfileJson). The merge must set the right flag and PRESERVE every
// other field already in the blob — otherwise dismissing a banner would wipe
// the sitter's profile JSON.

test("applyBannerDismissal sets the flag and preserves other fields", () => {
  const before = JSON.stringify({ firstName: "Sonia", services: { Promenade: true }, dismissedBanners: {} });
  const after = JSON.parse(applyBannerDismissal(before, "completionCard"));
  assert.equal(after.firstName, "Sonia");
  assert.deepEqual(after.services, { Promenade: true });
  assert.equal(after.dismissedBanners.completionCard, true);
});

test("applyBannerDismissal keeps a previously-dismissed banner dismissed", () => {
  const before = JSON.stringify({ dismissedBanners: { accountActivated: true } });
  const after = JSON.parse(applyBannerDismissal(before, "completionCard"));
  assert.equal(after.dismissedBanners.accountActivated, true);
  assert.equal(after.dismissedBanners.completionCard, true);
});

test("applyBannerDismissal handles null / malformed JSON", () => {
  assert.equal(JSON.parse(applyBannerDismissal(null, "accountActivated")).dismissedBanners.accountActivated, true);
  assert.equal(JSON.parse(applyBannerDismissal("not json", "accountActivated")).dismissedBanners.accountActivated, true);
});

test("readDismissedBanners reflects persisted flags", () => {
  assert.deepEqual(readDismissedBanners(null), {});
  const json = JSON.stringify({ dismissedBanners: { accountActivated: true } });
  const read = readDismissedBanners(json);
  assert.equal(read.accountActivated, true);
  assert.equal(read.completionCard, false);
});
