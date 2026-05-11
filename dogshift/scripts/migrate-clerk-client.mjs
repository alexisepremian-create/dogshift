#!/usr/bin/env node
/**
 * Client-side Clerk → Auth.js v5 migration (PR 2 phase 6).
 *
 * Replaces useUser / useAuth / useClerk / SignOutButton from @clerk/nextjs
 * with the next-auth/react equivalents.
 *
 * Patterns handled:
 *   import { useUser, useAuth, useClerk, SignOutButton } from "@clerk/nextjs";
 *   ↓
 *   import { useSession, signOut } from "next-auth/react";
 *
 *   const { user, isLoaded, isSignedIn } = useUser();
 *   ↓
 *   const { data: session, status } = useSession();
 *   const user = session?.user ?? null;
 *   const isLoaded = status !== "loading";
 *   const isSignedIn = status === "authenticated";
 *
 *   user?.primaryEmailAddress?.emailAddress  →  session?.user?.email
 *   user?.fullName / user?.firstName         →  session?.user?.name
 *   clerk.signOut() / useClerk().signOut()   →  signOut()
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

const FILES = [
  "app/(marketing)/account/bookings/[id]/page.tsx",
  "app/(marketing)/account/bookings/[id]/review/page.tsx",
  "app/(marketing)/account/bookings/page.tsx",
  "app/(marketing)/account/dogs/page.tsx",
  "app/(marketing)/account/messages/[id]/page.tsx",
  "app/(marketing)/account/messages/page.tsx",
  "app/(marketing)/account/settings/page.tsx",
  "app/(marketing)/account/wallet/page.tsx",
  "app/(marketing)/become-sitter/activate/page.tsx",
  "app/(marketing)/sitter/[sitterId]/page.tsx",
  "app/(protected)/host/page.tsx",
  "app/(protected)/post-login/page.tsx",
  "app/signup/page.tsx",
  "components/AccountSettingsClient.tsx",
  "components/BecomeSitterForm.tsx",
  "components/ClerkAuthGate.tsx",
  "components/CguUpdateBanner.tsx",
  "components/HelpContactForm.tsx",
  "components/HostDashboardShell.tsx",
  "components/HostDataGate.tsx",
  "components/HostShell.tsx",
  "components/HostSidebar.tsx",
  "components/HostTopNav.tsx",
  "components/LeadMagnetBanner.tsx",
  "components/OwnerDashboardShell.tsx",
  "components/OwnerShell.tsx",
  "components/OwnerSidebar.tsx",
  "components/PushPermissionPrompt.tsx",
  "components/SiteHeader.tsx",
  "components/dashboardNavItems.tsx",
];

const REPLACEMENTS = [
  // 1) Import line (whatever subset of hooks they pull, we replace with useSession + signOut).
  [
    /^import \{ ([^}]*) \} from "@clerk\/nextjs";$/gm,
    () => `import { useSession, signOut } from "next-auth/react";`,
  ],
  [
    /^import \{ ([^}]*)\} from "@clerk\/nextjs";$/gm,
    () => `import { useSession, signOut } from "next-auth/react";`,
  ],

  // 2) useUser() destructure variants — order-agnostic for the 3 common fields.
  [
    /const \{ user, isLoaded, isSignedIn \} = useUser\(\);/g,
    `const { data: __session, status: __sessionStatus } = useSession();
  const user = __session?.user ?? null;
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";`,
  ],
  [
    /const \{ isLoaded, isSignedIn, user \} = useUser\(\);/g,
    `const { data: __session, status: __sessionStatus } = useSession();
  const user = __session?.user ?? null;
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";`,
  ],
  [
    /const \{ user, isSignedIn, isLoaded \} = useUser\(\);/g,
    `const { data: __session, status: __sessionStatus } = useSession();
  const user = __session?.user ?? null;
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";`,
  ],
  [
    /const \{ isLoaded, isSignedIn \} = useUser\(\);/g,
    `const { status: __sessionStatus } = useSession();
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";`,
  ],
  [
    /const \{ isSignedIn, isLoaded \} = useUser\(\);/g,
    `const { status: __sessionStatus } = useSession();
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";`,
  ],
  [
    /const \{ isLoaded, isSignedIn \} = useAuth\(\);/g,
    `const { status: __sessionStatus } = useSession();
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";`,
  ],
  [
    /const \{ user, isLoaded \} = useUser\(\);/g,
    `const { data: __session, status: __sessionStatus } = useSession();
  const user = __session?.user ?? null;
  const isLoaded = __sessionStatus !== "loading";`,
  ],
  [
    /const \{ user \} = useUser\(\);/g,
    `const { data: __session } = useSession();
  const user = __session?.user ?? null;`,
  ],
  [
    /const \{ isLoaded \} = useUser\(\);/g,
    `const { status: __sessionStatus } = useSession();
  const isLoaded = __sessionStatus !== "loading";`,
  ],
  [
    /const \{ isSignedIn \} = useUser\(\);/g,
    `const { status: __sessionStatus } = useSession();
  const isSignedIn = __sessionStatus === "authenticated";`,
  ],

  // 3) useAuth() destructure (similar shape to useUser).
  [
    /const \{ userId, isLoaded, isSignedIn \} = useAuth\(\);/g,
    `const { data: __session, status: __sessionStatus } = useSession();
  const userId = __session?.user?.id ?? null;
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";`,
  ],
  [
    /const \{ isLoaded: authLoaded, userId: authUserId, isSignedIn: authIsSignedIn \} = useAuth\(\);/g,
    `const { data: __sessionAuth, status: __sessionAuthStatus } = useSession();
  const authLoaded = __sessionAuthStatus !== "loading";
  const authUserId = __sessionAuth?.user?.id ?? null;
  const authIsSignedIn = __sessionAuthStatus === "authenticated";`,
  ],
  [
    /const \{ userId \} = useAuth\(\);/g,
    `const { data: __session } = useSession();
  const userId = __session?.user?.id ?? null;`,
  ],

  // 4) useClerk().signOut() → signOut() from next-auth/react.
  [/useClerk\(\)\.signOut\(/g, `signOut(`],
  [/const clerk = useClerk\(\);\n/g, ``],
  [/clerk\.signOut\(/g, `signOut(`],
  // useClerk() called for side effects (no destructure) — drop the line.
  [/^\s*useClerk\(\);\s*$/gm, ``],
  // useSignUp from legacy still leaks through — wipe the call sites.
  [/useSignUp\(\)/g, `null /* useSignUp removed with Clerk */`],

  // 5) user.primaryEmailAddress.emailAddress patterns.
  [/user\?\.primaryEmailAddress\?\.emailAddress/g, `user?.email`],
  [/\buser\.primaryEmailAddress\?\.emailAddress/g, `user?.email`],
  [/user\?\.fullName \|\| user\?\.firstName/g, `user?.name`],
  [/user\?\.fullName/g, `user?.name`],
  [/user\?\.firstName/g, `user?.name`],
  [/user\?\.imageUrl/g, `user?.image`],

  // 6) SignOutButton component → inline button (best-effort — caller may need adjust).
  // Replace JSX <SignOutButton><X/></SignOutButton> with a <button onClick={() => signOut(...)}>X</button>
  // To stay safe, we only swap the most common simple form.
  [
    /<SignOutButton\s*signOutCallback=\{[^}]+\}>([\s\S]*?)<\/SignOutButton>/g,
    `<button type="button" onClick={() => signOut({ callbackUrl: "/login?force=1" })}>$1</button>`,
  ],
  [
    /<SignOutButton>([\s\S]*?)<\/SignOutButton>/g,
    `<button type="button" onClick={() => signOut({ callbackUrl: "/login?force=1" })}>$1</button>`,
  ],
];

let modified = 0;
const flagged = [];
for (const rel of FILES) {
  const abs = resolve(ROOT, rel);
  let c;
  try {
    c = readFileSync(abs, "utf8");
  } catch {
    console.log(`[skip] ${rel} (read fail)`);
    continue;
  }

  let updated = c;
  for (const [re, rep] of REPLACEMENTS) updated = updated.replace(re, rep);

  if (updated.includes("@clerk/nextjs")) flagged.push(rel);

  if (updated !== c) {
    writeFileSync(abs, updated);
    modified += 1;
    console.log(`[edit] ${rel}`);
  } else {
    console.log(`[noop] ${rel}`);
  }
}

console.log(`\n=== client SUMMARY ===\nmodified: ${modified}\nflagged: ${flagged.length}`);
if (flagged.length) for (const f of flagged) console.log(`  - ${f}`);
