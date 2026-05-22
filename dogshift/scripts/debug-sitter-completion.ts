/**
 * Diagnostic : pourquoi un sitter voit X% dans son dashboard mais reçoit
 * des emails à un autre %.
 *
 * Compare les DEUX sources de vérité utilisées dans le code :
 *
 *   A) Dashboard /host/profile/edit  →  lit User.hostProfileJson (blob JSON)
 *                                       + host.stripeAccountStatus
 *
 *   B) Cron sitter-onboarding-nudge  →  lit SitterProfile.* (colonnes)
 *
 * Pour chaque source, on calcule les 8 checks de
 * computeSitterProfileCompletionDetails et on les met côte à côte.
 *
 * Usage :
 *   npx tsx --env-file=.env.local scripts/debug-sitter-completion.ts <email|search>
 *
 *   - <email>  → match exact User.email = ...
 *   - <search> → match partiel sur User.email OU SitterProfile.displayName
 *
 * Exit 0 si tout est aligné, 1 si divergence détectée.
 */

import { PrismaClient } from "@prisma/client";

import {
  computeSitterProfileCompletionDetails,
  type ProfileCompletionChecks,
} from "@/lib/sitterCompletion";

const prisma = new PrismaClient();

type CronProfileSnapshot = {
  avatarUrl: string | null;
  firstName: string | null;
  city: string | null;
  address: string | null;
  bio: string | null;
  services: unknown;
  pricing: unknown;
  acceptsSmall: boolean;
  acceptsMedium: boolean;
  acceptsLarge: boolean;
  stripeAccountStatus: string | null;
};

function row(check: keyof ProfileCompletionChecks, a: boolean, b: boolean) {
  const same = a === b;
  const left = a ? "✓" : "✗";
  const right = b ? "✓" : "✗";
  const tag = same ? "  ok" : "DIFF";
  return `  ${tag}  ${check.padEnd(18)} dashboard:${left}   cron:${right}`;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npx tsx --env-file=.env.local scripts/debug-sitter-completion.ts <email|search>");
    process.exit(2);
  }

  // Find the User (+ join SitterProfile) — accept exact email match OR a partial substring on email/displayName.
  const lowered = arg.toLowerCase();
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { equals: arg, mode: "insensitive" } },
        { email: { contains: lowered, mode: "insensitive" } },
        { name: { contains: arg, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      sitterId: true,
      hostProfileJson: true,
    },
    take: 5,
  });

  if (users.length === 0) {
    console.error(`No user found matching "${arg}"`);
    process.exit(2);
  }
  if (users.length > 1) {
    console.error(`Multiple users found matching "${arg}":`);
    for (const u of users) {
      console.error(`  - ${u.email}  (${u.name ?? "no name"})`);
    }
    console.error("Refine the query (use the exact email).");
    process.exit(2);
  }
  const user = users[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sp = (await (prisma as any).sitterProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      userId: true,
      sitterId: true,
      published: true,
      lifecycleStatus: true,
      activatedAt: true,
      profileCompletion: true,
      avatarUrl: true,
      displayName: true,
      city: true,
      postalCode: true,
      address: true,
      bio: true,
      services: true,
      pricing: true,
      acceptsSmall: true,
      acceptsMedium: true,
      acceptsLarge: true,
      stripeAccountStatus: true,
      stripeAccountId: true,
      stripeOnboardingCompletedAt: true,
    },
  })) as null | (CronProfileSnapshot & {
    id: string;
    sitterId: string;
    published: boolean;
    lifecycleStatus: string | null;
    activatedAt: Date | null;
    profileCompletion: number | null;
    displayName: string | null;
    postalCode: string | null;
    stripeAccountId: string | null;
    stripeOnboardingCompletedAt: Date | null;
  });

  if (!sp) {
    console.error(`User ${user.email} has no SitterProfile row — not a sitter.`);
    process.exit(2);
  }

  console.log("===========================================================");
  console.log(`Sitter : ${user.name ?? "(no name)"} <${user.email}>`);
  console.log(`User.id         : ${user.id}`);
  console.log(`SitterProfile.id: ${sp.id}`);
  console.log(`sitterId        : ${sp.sitterId}`);
  console.log(`lifecycleStatus : ${sp.lifecycleStatus ?? "(null)"}`);
  console.log(`published       : ${sp.published}`);
  console.log(`activatedAt     : ${sp.activatedAt?.toISOString() ?? "(null)"}`);
  console.log(`stored .profileCompletion : ${sp.profileCompletion ?? "(null)"}`);
  console.log("===========================================================");

  // --- SOURCE A — dashboard view (User.hostProfileJson) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hostJsonRaw = (user as any).hostProfileJson;
  let dashboardSnapshot: unknown = null;
  if (hostJsonRaw) {
    try {
      dashboardSnapshot = JSON.parse(hostJsonRaw);
    } catch (err) {
      console.error("Failed to parse User.hostProfileJson", err);
    }
  }
  if (!dashboardSnapshot) {
    console.log("\n[A] User.hostProfileJson is EMPTY or unparseable → dashboard would show 0%");
  }

  const dashboardProfile =
    dashboardSnapshot && typeof dashboardSnapshot === "object"
      ? {
          ...dashboardSnapshot,
          // The dashboard overlays the live Stripe status (host.stripeAccountStatus,
          // refreshed by /api/host/stripe/connect/status). To mimic that, we also
          // overlay it here.
          stripeAccountStatus: sp.stripeAccountStatus,
        }
      : null;

  const A = dashboardProfile ? computeSitterProfileCompletionDetails(dashboardProfile) : null;

  // --- SOURCE B — cron view (SitterProfile columns) ---
  const cronSnapshot: CronProfileSnapshot = {
    avatarUrl: sp.avatarUrl,
    firstName: sp.displayName ?? user.name,
    city: sp.city,
    address: sp.address,
    bio: sp.bio,
    services: sp.services,
    pricing: sp.pricing,
    acceptsSmall: sp.acceptsSmall ?? false,
    acceptsMedium: sp.acceptsMedium ?? false,
    acceptsLarge: sp.acceptsLarge ?? false,
    stripeAccountStatus: sp.stripeAccountStatus,
  };
  const B = computeSitterProfileCompletionDetails(cronSnapshot);

  console.log("\n--- DASHBOARD (User.hostProfileJson) ---");
  console.log(`  percent : ${A?.percent ?? "(no JSON, treated as 0%)"}`);
  if (dashboardProfile) {
    console.log(`  address(JSON)    : ${JSON.stringify((dashboardProfile as { address?: unknown }).address ?? null)}`);
    console.log(`  city(JSON)       : ${JSON.stringify((dashboardProfile as { city?: unknown }).city ?? null)}`);
    console.log(`  firstName(JSON)  : ${JSON.stringify((dashboardProfile as { firstName?: unknown }).firstName ?? null)}`);
    console.log(`  services(JSON)   : ${JSON.stringify((dashboardProfile as { services?: unknown }).services ?? null)}`);
    console.log(`  pricing(JSON)    : ${JSON.stringify((dashboardProfile as { pricing?: unknown }).pricing ?? null)}`);
    console.log(`  avatarUrl(JSON)  : ${JSON.stringify((dashboardProfile as { avatarUrl?: unknown }).avatarUrl ?? null)}`);
  }

  console.log("\n--- CRON (SitterProfile.*) ---");
  console.log(`  percent : ${B.percent}`);
  console.log(`  address(col)    : ${JSON.stringify(sp.address)}`);
  console.log(`  postalCode(col) : ${JSON.stringify(sp.postalCode)}`);
  console.log(`  city(col)       : ${JSON.stringify(sp.city)}`);
  console.log(`  displayName(col): ${JSON.stringify(sp.displayName)}`);
  console.log(`  services(col)   : ${JSON.stringify(sp.services)}`);
  console.log(`  pricing(col)    : ${JSON.stringify(sp.pricing)}`);
  console.log(`  avatarUrl(col)  : ${JSON.stringify(sp.avatarUrl)}`);
  console.log(`  stripeAccountStatus(col): ${JSON.stringify(sp.stripeAccountStatus)}`);
  console.log(`  stripeAccountId(col)    : ${JSON.stringify(sp.stripeAccountId)}`);

  if (A) {
    console.log("\n--- 8 CHECKS (dashboard vs cron) ---");
    const keys: (keyof ProfileCompletionChecks)[] = [
      "avatar",
      "identity",
      "address",
      "bio",
      "services",
      "pricing",
      "dogSizes",
      "stripeConnected",
    ];
    for (const k of keys) {
      console.log(row(k, A.checks[k], B.checks[k]));
    }
  } else {
    console.log("\n(can't diff checks — User.hostProfileJson is empty)");
  }

  const aligned = A && A.percent === B.percent;
  console.log("\n===========================================================");
  if (aligned) {
    console.log("✅ Aligned — dashboard and cron compute the SAME percent.");
    console.log("   If the sitter still complains, the gap is between her PERCEPTION (\"I filled the form\")");
    console.log("   and the validator definition (e.g. address requires NPA+ville, stripeConnected requires");
    console.log("   accounts.charges_enabled && payouts_enabled).");
  } else if (!A) {
    console.log("⚠️  Cannot diff — User.hostProfileJson missing. Dashboard would also show 0%.");
  } else {
    console.log("🚨 DIVERGENCE detected. Dashboard shows " + A.percent + "%, cron sees " + B.percent + "%.");
    console.log("   → Source-of-truth desync. Look at the DIFF rows above to identify which field(s).");
  }
  console.log("===========================================================");

  await prisma.$disconnect();
  process.exit(aligned ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(2);
});
