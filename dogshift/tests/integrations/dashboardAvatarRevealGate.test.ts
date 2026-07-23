import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * The sitter dashboard must reveal everything AT ONCE after its loading
 * skeleton — including the profile photo. Before this gate the skeleton handed
 * off as soon as auth + verification were ready, and the avatar `<Image>` then
 * loaded over the network → an empty circle that popped in a beat later
 * (founder). We now hold the skeleton until the avatar is decoded.
 */
test("host dashboard holds the skeleton until the avatar photo is decoded", () => {
  const src = read("app/(protected)/host/page.tsx");

  // A dedicated readiness flag for the avatar.
  assert.match(src, /const \[avatarReady, setAvatarReady\] = useState\(false\)/, "must track avatar readiness.");

  // It preloads the avatar image (or resolves instantly for no/data: URLs) and
  // is capped so a slow/broken image can't trap the dashboard on the skeleton.
  assert.match(src, /new window\.Image\(\)/, "must preload the avatar image off-DOM.");
  assert.match(src, /img\.onload = finish/, "must resolve on image load.");
  assert.match(src, /img\.onerror = finish/, "must resolve on image error (never hang).");
  assert.match(src, /setTimeout\(finish, 2500\)/, "must cap the wait so it never hangs.");

  // The reveal is gated: while the avatar isn't ready we keep the skeleton.
  assert.match(src, /if \(sitterId && !avatarReady\) \{[\s\S]*?return <HostDashboardSkeleton \/>/, "must hold the skeleton until the avatar is ready.");
});
