import { prisma } from "@/lib/prisma";

let cached: { value: boolean; checkedAtMs: number } | null = null;
const TTL_MS = 60_000;

export async function contractAmendmentStatusColumnExists(): Promise<boolean> {
  const now = Date.now();
  if (cached && now - cached.checkedAtMs < TTL_MS) return cached.value;

  try {
    const rows = (await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM pg_attribute a
        WHERE a.attrelid = to_regclass('public."ContractAmendment"')
          AND a.attname = 'status'
          AND a.attisdropped = false
      ) AS "exists"
    `) as Array<{ exists: boolean }>;

    const exists = Boolean(rows?.[0]?.exists);
    cached = { value: exists, checkedAtMs: now };
    return exists;
  } catch (err) {
    // If introspection fails (network/permissions), be conservative: assume column is absent.
    cached = { value: false, checkedAtMs: now };
    return false;
  }
}

