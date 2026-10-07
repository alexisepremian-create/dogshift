import { timingSafeEqual } from "node:crypto";
import { getAdminAccessState } from "@/lib/adminAuth";

/** Fail closed. These legacy automation routes can send mail, spend API credit
 * and access private records; only the internal key or full admin access is allowed.
 */
export async function isInternalAgentRequest(req: Request): Promise<boolean> {
  const expected = process.env.N8N_WEBHOOK_SECRET?.trim();
  const provided = (req.headers.get("x-webhook-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "").trim();
  if (expected && provided) {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  // Preserve the existing admin console; ordinary owner/sitter sessions fail.
  return (await getAdminAccessState()).isAdmin;
}

export function internalAgentHeaders(): Record<string, string> {
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim();
  return secret ? { "x-webhook-secret": secret } : {};
}
