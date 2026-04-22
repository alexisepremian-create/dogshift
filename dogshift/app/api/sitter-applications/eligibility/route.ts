import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  clerkUserIsExistingSitter,
  emailBelongsToExistingSitter,
  normalizeApplicationEmail,
} from "@/lib/sitterApplication/existingSitter";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

type EligibilityReason = "signed_in_as_sitter" | "email_belongs_to_sitter";

type EligibilityResponse = {
  eligible: boolean;
  reason?: EligibilityReason;
  signedInEmail?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lightweight probe used by the public application form to tell the user,
 * before they hit submit, that they can't reapply because they (or the email
 * they typed) already resolve to a DogShift sitter. Never leaks whether the
 * email exists as a plain user — only whether it matches a sitter.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawEmail = url.searchParams.get("email") ?? "";
  const normalizedEmail = normalizeApplicationEmail(rawEmail);

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    "unknown";
  const rl = checkRateLimit(`sitter-apply-eligibility:${ip}`, {
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { eligible: true, throttled: true } satisfies EligibilityResponse & {
        throttled: boolean;
      },
      { status: 200 },
    );
  }

  let signedInEmail: string | null = null;
  try {
    const { userId: clerkUserId } = await auth();
    if (clerkUserId) {
      const { isSitter, email } = await clerkUserIsExistingSitter(clerkUserId);
      signedInEmail = email;
      if (isSitter) {
        return NextResponse.json(
          {
            eligible: false,
            reason: "signed_in_as_sitter",
            signedInEmail,
          } satisfies EligibilityResponse,
          { status: 200 },
        );
      }
    }
  } catch (err) {
    console.warn("[api][sitter-applications][eligibility] clerk lookup failed", err);
  }

  if (normalizedEmail && EMAIL_RE.test(normalizedEmail)) {
    try {
      const emailIsSitter = await emailBelongsToExistingSitter(normalizedEmail);
      if (emailIsSitter) {
        return NextResponse.json(
          {
            eligible: false,
            reason: "email_belongs_to_sitter",
            signedInEmail,
          } satisfies EligibilityResponse,
          { status: 200 },
        );
      }
    } catch (err) {
      console.warn(
        "[api][sitter-applications][eligibility] email lookup failed",
        err,
      );
    }
  }

  return NextResponse.json(
    { eligible: true, signedInEmail } satisfies EligibilityResponse,
    { status: 200 },
  );
}
