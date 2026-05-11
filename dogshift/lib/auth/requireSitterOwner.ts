import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Sitter-ownership gate used by `/api/host/**` endpoints.
 *
 * Reads the Auth.js session, looks up the linked SitterProfile, and either
 * lets the request through with `{ ok: true, dbUserId, sitterId }` or returns
 * the appropriate HTTP status for the caller to forward.
 *
 *  - 401 UNAUTHORIZED: no session at all
 *  - 403 FORBIDDEN: session present but no SitterProfile attached
 */
export type RequireSitterOwnerResult =
  | { ok: true; dbUserId: string; sitterId: string }
  | { ok: false; status: 401 | 403; error: "UNAUTHORIZED" | "FORBIDDEN" };

export async function requireSitterOwner(_req: NextRequest): Promise<RequireSitterOwnerResult> {
  void _req;

  const session = await auth();
  const dbUserId = session?.user?.id ?? "";
  if (!dbUserId) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  const sitterProfile = await prisma.sitterProfile.findUnique({
    where: { userId: dbUserId },
    select: { sitterId: true },
  });
  const sitterId =
    typeof sitterProfile?.sitterId === "string" && sitterProfile.sitterId.trim()
      ? sitterProfile.sitterId.trim()
      : "";
  if (!sitterId) return { ok: false, status: 403, error: "FORBIDDEN" };

  return { ok: true, dbUserId, sitterId };
}
