import { prisma } from "@/lib/prisma";

let cached: { value: boolean; checkedAtMs: number } | null = null;
const TTL_MS = 60_000;

export async function contractAmendmentStatusColumnExists(): Promise<boolean> {
  const now = Date.now();
  if (cached && now - cached.checkedAtMs < TTL_MS) return cached.value;

  try {
    const rows = (await prisma.$queryRaw`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND lower(table_name) = lower('ContractAmendment')
        AND column_name = 'status'
      LIMIT 1
    `) as Array<{ "?column?": number }> | Array<{ [k: string]: unknown }>;

    const exists = Array.isArray(rows) && rows.length > 0;
    cached = { value: exists, checkedAtMs: now };
    return exists;
  } catch (err) {
    // If introspection fails (network/permissions), be conservative: assume column is absent.
    cached = { value: false, checkedAtMs: now };
    return false;
  }
}

