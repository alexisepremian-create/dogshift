import type { NextRequest } from "next/server";

import { POST as stripeWebhookPost } from "../../stripe/webhook/route";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return stripeWebhookPost(req);
}
