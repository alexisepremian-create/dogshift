#!/usr/bin/env node
/**
 * One-shot bulk migration: Clerk imports → Auth.js v5.
 *
 * Used by PR 2 of the Clerk → Auth.js migration to mechanically rewrite
 * the ~50 server-side route handlers that follow the same auth pattern.
 *
 * Patterns handled:
 *
 *   import { auth, currentUser } from "@clerk/nextjs/server";
 *   ↓
 *   import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
 *
 *   import { auth } from "@clerk/nextjs/server";
 *   ↓
 *   import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
 *
 *   import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
 *   ↓  (also drops clerkClient — caller code must be updated by hand)
 *
 *   import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
 *   ↓
 *   (removed when no longer referenced)
 *
 *   const { userId } = await auth();
 *   ↓
 *   const __authed = await getAuthedDbUser();
 *   const userId = __authed?.id ?? null;
 *
 *   const clerkUser = await currentUser();
 *   const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
 *   const name = clerkUser?.fullName || clerkUser?.firstName || null;
 *   ↓
 *   const email = __authed?.email ?? "";
 *   const name = __authed?.name ?? null;
 *
 * Run from the dogshift directory:
 *   node scripts/migrate-clerk-imports.mjs
 *
 * The script reports:
 *   - Files modified
 *   - Files skipped (no Clerk imports)
 *   - Files flagged for manual review (use clerkClient, complex patterns)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

const FILES = [
  "app/(marketing)/become-sitter/page.tsx",
  "app/(marketing)/become-sitter/form/page.tsx",
  "app/(marketing)/devenir-dogsitter/candidater/page.tsx",
  "app/(marketing)/sitter/[sitterId]/reservation/page.tsx",
  "app/(marketing)/account/page.tsx",
  "app/(protected)/host/layout.tsx",
  "app/api/account/delete/route.ts",
  "app/api/admin/maintenance/route.ts",
  "app/api/admin/notes/route.ts",
  "app/api/admin/notify-users/route.ts",
  "app/api/admin/session/route.ts",
  "app/api/auth/resolve-redirect/route.ts",
  "app/api/auth/set-password/route.ts",
  "app/api/audit/consent/route.ts",
  "app/api/become-sitter/apply/route.ts",
  "app/api/contract/generate-pdf/route.ts",
  "app/api/debug/auth/route.ts",
  "app/api/debug-session/route.ts",
  "app/api/host/accept-compliance/route.ts",
  "app/api/host/accept-terms/route.ts",
  "app/api/host/contract-amendment/accept/route.ts",
  "app/api/host/messages/conversations/[id]/messages/route.ts",
  "app/api/host/messages/conversations/[id]/route.ts",
  "app/api/host/messages/conversations/route.ts",
  "app/api/host/messages/conversations/start/route.ts",
  "app/api/host/profile/avatar/commit/route.ts",
  "app/api/host/profile/avatar/presign/route.ts",
  "app/api/host/profile/pricing/route.ts",
  "app/api/host/profile/route.ts",
  "app/api/host/requests/[id]/accept/route.ts",
  "app/api/host/requests/[id]/archive/route.ts",
  "app/api/host/requests/[id]/cancel-confirmed/route.ts",
  "app/api/host/requests/[id]/decline/route.ts",
  "app/api/host/requests/[id]/route.ts",
  "app/api/host/requests/[id]/unarchive/route.ts",
  "app/api/host/requests/route.ts",
  "app/api/host/stripe/connect/create/route.ts",
  "app/api/host/stripe/connect/link/route.ts",
  "app/api/host/stripe/connect/login-link/route.ts",
  "app/api/host/stripe/connect/status/route.ts",
  "app/api/host/verification/delete/route.ts",
  "app/api/host/verification/presign/route.ts",
  "app/api/host/verification/status/route.ts",
  "app/api/host/verification/submit/route.ts",
  "app/api/messages/conversations/route.ts",
  "app/api/role/make-sitter/route.ts",
  "app/api/account/bookings/route.ts",
  "app/api/account/dogs/route.ts",
  "app/api/account/dogs/[id]/route.ts",
  "app/api/account/settings/me/route.ts",
  "app/api/sitter-applications/eligibility/route.ts",
  "app/api/sitter-applications/route.ts",
  "lib/hostUser.ts",
];

// Each entry: [regex, replacement]. Order matters — apply in sequence.
const REPLACEMENTS = [
  // 1) Import line variants — we always converge to the same helper.
  [
    /^import \{ ([^}]*)\} from "@clerk\/nextjs\/server";$/gm,
    (_match, symbols) => {
      const has = (s) => new RegExp(`\\b${s}\\b`).test(symbols);
      const usesClerkClient = has("clerkClient");
      const lines = [
        `import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";`,
      ];
      if (usesClerkClient) {
        lines.push(
          `// TODO(PR2): clerkClient() removed — replace its callers with prisma/bcrypt direct calls.`,
        );
      }
      return lines.join("\n");
    },
  ],

  // 2) const { userId } = await auth();  — common destructure.
  [
    /const \{ userId \} = await auth\(\);/g,
    `const __authed = await getAuthedDbUser();\n    const userId = __authed?.id ?? null;`,
  ],

  // 2b) Destructure-with-rename: const { userId: clerkUserId } = await auth();
  [
    /const \{ userId: clerkUserId \} = await auth\(\);/g,
    `const __authed = await getAuthedDbUser();\n    const clerkUserId = __authed?.id ?? null;`,
  ],

  // 3) currentUser() lookup + primaryEmailAddress extraction (common pattern).
  [
    /const \w+ = await currentUser\(\);\n/g,
    `// currentUser() removed — use __authed.email / __authed.name\n`,
  ],

  // 3b) Inline await currentUser() calls (not assigned).
  [
    /await currentUser\(\)/g,
    `null /* await currentUser() — use __authed instead */`,
  ],

  // 4) email extraction patterns.
  [
    /\w+\?\.primaryEmailAddress\?\.emailAddress \?\? ""/g,
    `__authed?.email ?? ""`,
  ],
  [
    /\w+\?\.primaryEmailAddress\?\.emailAddress \|\| ""/g,
    `__authed?.email ?? ""`,
  ],
  // Without quoted fallback.
  [
    /\w+\?\.primaryEmailAddress\?\.emailAddress/g,
    `__authed?.email`,
  ],

  // 5) fullName / firstName patterns → __authed.name.
  [
    /\w+\?\.fullName \|\| \w+\?\.firstName \|\| null/g,
    `__authed?.name ?? null`,
  ],
  [
    /typeof \w+\?\.fullName === "string" \? \w+\.fullName : null/g,
    `__authed?.name ?? null`,
  ],
  [
    /\w+\?\.fullName/g,
    `__authed?.name`,
  ],
  [
    /\w+\?\.firstName/g,
    `__authed?.name`,
  ],

  // 6) ensureDbUserByClerkUserId({ ... }) — single-line variant.
  [
    /const ensured = await ensureDbUserByClerkUserId\(\{[^}]*\}\);[\s\S]*?if \(!ensured\?\.id\)[^\n]*\n/g,
    `if (!__authed?.id) return new Response("Unauthorized", { status: 401 });\n`,
  ],

  // 6b) Multi-line ensureDbUserByClerkUserId({\n  clerkUserId: ...,\n  ...\n}) — match across lines, non-greedy.
  [
    /await ensureDbUserByClerkUserId\(\{[\s\S]*?\}\)/g,
    `(__authed ? { id: __authed.id, role: __authed.role, sitterId: __authed.sitterId, created: false } : null)`,
  ],

  // 7) ensured.id / ensured.role / ensured.sitterId → __authed.*.
  [/\bensured\.id\b/g, `__authed.id`],
  [/\bensured\.role\b/g, `__authed.role`],
  [/\bensured\.sitterId\b/g, `__authed.sitterId`],
  [/\bensured\?\.id\b/g, `__authed?.id`],
  [/\bensured\?\.role\b/g, `__authed?.role`],
  [/\bensured\?\.sitterId\b/g, `__authed?.sitterId`],

  // 8) Drop the now-orphan ensureDbUserByClerkUserId import.
  [
    /import \{ ensureDbUserByClerkUserId \} from "@\/lib\/auth\/resolveDbUserId";\n/g,
    ``,
  ],

];

let totalModified = 0;
let totalSkipped = 0;
const flagged = [];

for (const rel of FILES) {
  const abs = resolve(ROOT, rel);
  let content;
  try {
    content = readFileSync(abs, "utf8");
  } catch (err) {
    console.error(`[SKIP] cannot read ${rel}: ${err.message}`);
    continue;
  }

  if (!content.includes("@clerk/nextjs/server")) {
    totalSkipped += 1;
    console.log(`[skip] ${rel} — already clean`);
    continue;
  }

  let updated = content;
  for (const [pattern, replacement] of REPLACEMENTS) {
    updated = updated.replace(pattern, replacement);
  }

  // Flag for manual review when the simple replacements aren't enough.
  if (updated.includes("@clerk/nextjs") || updated.includes("clerkClient(")) {
    flagged.push(rel);
  }

  if (updated !== content) {
    writeFileSync(abs, updated);
    totalModified += 1;
    console.log(`[edit] ${rel}`);
  } else {
    console.log(`[noop] ${rel}`);
  }
}

console.log("\n=== SUMMARY ===");
console.log(`modified: ${totalModified}`);
console.log(`skipped (already clean): ${totalSkipped}`);
console.log(`flagged for manual review: ${flagged.length}`);
if (flagged.length) {
  console.log("\nFiles still containing @clerk or clerkClient() — handle manually:");
  for (const f of flagged) console.log(`  - ${f}`);
}
