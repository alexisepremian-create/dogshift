#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * One-shot: send the 5 onboarding nudge stages to alexis.epremian@gmail.com
 * as test emails, PLUS the actual day_3 email that Sysy will receive tomorrow
 * (built from her real DB profile).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/brain/send-onboarding-nudge-tests.ts
 *
 * Does NOT write to AgentLog (no idempotency record). Pure test sender.
 */
import { PrismaClient } from "@prisma/client";
import { renderSitterOnboardingGuideEmail, type OnboardingNudgeStage } from "../../lib/email/templates/sitterOnboardingGuideEmail";
import { sendEmail } from "../../lib/email/sendEmail";

const prisma = new PrismaClient();

const TEST_RECIPIENT = "alexis.epremian@gmail.com";

// Mock profile mimicking a fresh sitter: nothing done yet → checklist all "to do"
const MOCK_FRESH_PROFILE = {
  firstName: "Alexis",
  city: "",
  bio: "",
  address: "",
  avatarUrl: "",
  services: {},
  pricing: {},
  acceptsSmall: false,
  acceptsMedium: false,
  acceptsLarge: false,
  stripeAccountStatus: null,
};

const STAGES: OnboardingNudgeStage[] = ["welcome", "day_1", "day_3", "day_7", "day_14"];

async function send(subjectPrefix: string, stage: OnboardingNudgeStage, firstName: string, profile: unknown) {
  const { subject, text, html } = renderSitterOnboardingGuideEmail({
    firstName,
    profile,
    stage,
    baseUrl: "https://www.dogshift.ch",
  });
  const finalSubject = `${subjectPrefix} ${subject}`;
  const r = await sendEmail({ to: TEST_RECIPIENT, subject: finalSubject, text, html });
  console.log(`✅ ${stage.padEnd(8)} → ${TEST_RECIPIENT}  (${r.mode}, id=${r.messageId ?? "-"})`);
}

async function main() {
  console.log(`📧 Sending 5 generic stage tests + Sysy's actual day_3 to ${TEST_RECIPIENT}\n`);

  // 1. The 5 generic stages with the mock fresh profile
  for (const stage of STAGES) {
    await send("[TEST]", stage, "Alexis", MOCK_FRESH_PROFILE);
  }

  // 2. Sysy's actual day_3 — pull her real profile from DB
  console.log("\n🔍 Loading Sysy's actual profile from prod DB…");
  const sitter = (await (prisma as any).sitterProfile.findFirst({
    where: {
      OR: [
        { displayName: { contains: "Sysy", mode: "insensitive" } },
        { user: { email: { contains: "syl.vetter85", mode: "insensitive" } } },
      ],
    },
    include: { user: true },
  })) as any | null;

  if (!sitter) {
    console.error("❌ Sysy not found in prod DB");
    process.exit(1);
  }

  const firstName = (sitter.displayName ?? sitter.user?.name ?? "Sysy").split(" ")[0] || "Sysy";
  await send("[SYSY DEMAIN]", "day_3", firstName, sitter);

  console.log("\n✨ Done. Check inbox.");
}

main()
  .catch((err) => {
    console.error("[send-onboarding-nudge-tests] error", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
