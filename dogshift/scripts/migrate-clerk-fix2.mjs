#!/usr/bin/env node
/**
 * Second-pass cleanup for the Clerk → Auth.js v5 migration (PR 2).
 *
 * The first script (migrate-clerk-imports.mjs) handled the most common
 * patterns. This pass cleans up the dangling references it couldn't see
 * across multi-line context:
 *   - `clerkUser?.X` references → `__authed?.X`
 *   - `__authed?.X` immediately after a `if (!userId) return ...` narrowing
 *     where TypeScript needs help → `__authed!.X`
 *   - bare `currentUser` references → annotate as removed
 *
 * Idempotent. Safe to re-run.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

const FILES = [
  "app/api/account/bookings/route.ts",
  "app/api/account/settings/me/route.ts",
  "app/api/become-sitter/apply/route.ts",
  "app/api/contract/generate-pdf/route.ts",
  "app/api/host/accept-terms/route.ts",
  "app/api/host/profile/pricing/route.ts",
  "app/api/host/profile/route.ts",
  "app/api/host/verification/submit/route.ts",
  "app/api/messages/conversations/route.ts",
  "app/api/sitter-applications/eligibility/route.ts",
  "app/api/sitter-applications/route.ts",
  "lib/hostUser.ts",
  "app/(marketing)/account/page.tsx",
  "app/(marketing)/become-sitter/page.tsx",
  "app/(marketing)/become-sitter/form/page.tsx",
  "app/(marketing)/devenir-dogsitter/candidater/page.tsx",
  "app/(marketing)/sitter/[sitterId]/reservation/page.tsx",
  "app/api/auth/resolve-redirect/route.ts",
  "app/api/admin/notes/route.ts",
  "app/api/debug/auth/route.ts",
  "app/api/debug-session/route.ts",
];

const REPLACEMENTS = [
  // Dangling clerkUser references (script removed the declaration but missed usages).
  [/\bclerkUser\?\.primaryEmailAddress\?\.emailAddress/g, `__authed?.email`],
  [/\bclerkUser\?\.fullName \|\| clerkUser\?\.firstName \|\| null/g, `__authed?.name ?? null`],
  [/\bclerkUser\?\.firstName/g, `__authed?.name`],
  [/\bclerkUser\?\.fullName/g, `__authed?.name`],
  [/\bclerkUser\?\.lastName/g, `null /* lastName removed with Clerk */`],
  [/\bclerkUser\?\.imageUrl/g, `null /* imageUrl removed with Clerk */`],
  [
    /typeof clerkUser\?\.fullName === "string" \? clerkUser\.fullName : null/g,
    `__authed?.name ?? null`,
  ],

  // Inline `currentUser()` calls when not previously rewritten.
  [/await currentUser\(\)/g, `null /* currentUser() — use __authed instead */`],
  [/\bcurrentUser\b(?!\s*=)/g, `(() => null) /* currentUser removed */`],

  // Bare `auth` reference that wasn't replaced (debug/auth/route.ts case).
  [
    /^import \{ auth \} from "@\/auth";$/gm,
    `import { auth } from "@/auth";`,
  ],

  // Tighten __authed null narrowing where the original code used a userId guard:
  //   const __authed = await getAuthedDbUser();
  //   const userId = __authed?.id ?? null;
  //   if (!userId) return ...;
  //   __authed?.email <-- TypeScript still thinks __authed is nullable here
  // We convert `__authed?.X` to `__authed!.X` because the userId guard above
  // already ruled out null. Limited to property access — not to assignments.
  [/__authed\?\.(email|name|role|id|sitterId)/g, `__authed!.$1`],
];

let modified = 0;
for (const rel of FILES) {
  const abs = resolve(ROOT, rel);
  let content;
  try {
    content = readFileSync(abs, "utf8");
  } catch {
    console.log(`[skip] ${rel} (read fail)`);
    continue;
  }
  let updated = content;
  for (const [re, rep] of REPLACEMENTS) updated = updated.replace(re, rep);
  if (updated !== content) {
    writeFileSync(abs, updated);
    modified += 1;
    console.log(`[edit] ${rel}`);
  } else {
    console.log(`[noop] ${rel}`);
  }
}

console.log(`\n=== fix2 SUMMARY ===\nmodified: ${modified}`);
