import { prisma } from "@/lib/prisma";

type StatusSupport = {
  supportsStatus: boolean;
  pgAttributeExists: boolean;
  infoSchemaExists: boolean;
  checkedAtMs: number;
};

let cached: StatusSupport | null = null;
const TTL_MS = 60_000;

export async function getContractAmendmentStatusSupport(): Promise<StatusSupport> {
  const now = Date.now();
  if (cached && now - cached.checkedAtMs < TTL_MS) return cached;

  let pgAttributeExists = false;
  let infoSchemaExists = false;
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
    pgAttributeExists = Boolean(rows?.[0]?.exists);
  } catch {
    pgAttributeExists = false;
  }

  try {
    const rows = (await prisma.$queryRaw`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND lower(table_name) = lower('ContractAmendment')
        AND column_name = 'status'
      LIMIT 1
    `) as Array<unknown>;
    infoSchemaExists = Array.isArray(rows) && rows.length > 0;
  } catch {
    infoSchemaExists = false;
  }

  // Require both catalog checks to agree to avoid false positives.
  const supportsStatus = Boolean(pgAttributeExists && infoSchemaExists);
  cached = { supportsStatus, pgAttributeExists, infoSchemaExists, checkedAtMs: now };
  return cached;
}

export async function contractAmendmentStatusColumnExists(): Promise<boolean> {
  const s = await getContractAmendmentStatusSupport();
  return s.supportsStatus;
}

