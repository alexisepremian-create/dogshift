import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { sendPushToUser } from "@/lib/push/send";

export const runtime = "nodejs";

// Only active outside production
const ENABLED = process.env.NODE_ENV !== "production";

export async function POST(req: NextRequest) {
  if (!ENABLED) {
    return NextResponse.json({ ok: false, error: "NOT_AVAILABLE" }, { status: 404 });
  }

  try {
    const userId = await resolveDbUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const result = await sendPushToUser(userId, {
      title: "Test DogShift 🐾",
      body: "Les notifications push fonctionnent correctement.",
      url: "/",
      tag: "push-test",
    });

    return NextResponse.json({ ok: true, sentTo: result.sent });
  } catch (err) {
    console.error("[api][push][test][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
