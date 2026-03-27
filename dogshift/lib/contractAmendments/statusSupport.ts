import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

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

type LegacyAmendmentRow = {
  id: string;
  title: string;
  content: string;
  version: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
};

export async function legacyDeactivateAllActiveAmendments() {
  await prisma.$executeRaw`
    UPDATE "ContractAmendment"
    SET "isActive" = false,
        "activatedAt" = NULL,
        "updatedAt" = NOW()
    WHERE "isActive" = true
  `;
}

export async function legacyCreateAmendment(args: {
  title: string;
  content: string;
  version: string;
  isActive: boolean;
}) {
  const id = randomUUID();
  const rows = (await prisma.$queryRaw`
    INSERT INTO "ContractAmendment" ("id", "title", "content", "version", "isActive", "activatedAt", "updatedAt")
    VALUES (
      ${id},
      ${args.title},
      ${args.content},
      ${args.version},
      ${args.isActive},
      ${args.isActive ? prisma.$queryRaw`NOW()` : null},
      NOW()
    )
    RETURNING "id", "title", "content", "version", "isActive", "createdAt", "updatedAt", "activatedAt"
  `) as LegacyAmendmentRow[];

  const row = rows?.[0];
  if (!row?.id) throw new Error("legacyCreateAmendment: insert failed");
  return { ...row, status: row.isActive ? "ACTIVE" : "INACTIVE" as const };
}

export async function legacySetAmendmentActive(id: string) {
  const rows = (await prisma.$queryRaw`
    UPDATE "ContractAmendment"
    SET "isActive" = true,
        "activatedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING "id", "title", "content", "version", "isActive", "createdAt", "updatedAt", "activatedAt"
  `) as LegacyAmendmentRow[];
  const row = rows?.[0];
  if (!row?.id) return null;
  return { ...row, status: "ACTIVE" as const };
}

export async function legacySetAmendmentInactive(id: string) {
  const rows = (await prisma.$queryRaw`
    UPDATE "ContractAmendment"
    SET "isActive" = false,
        "activatedAt" = NULL,
        "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING "id", "title", "content", "version", "isActive", "createdAt", "updatedAt", "activatedAt"
  `) as LegacyAmendmentRow[];
  const row = rows?.[0];
  if (!row?.id) return null;
  return { ...row, status: "INACTIVE" as const };
}

export async function legacySoftDeleteAmendment(id: string) {
  // No status column in legacy DB; we tombstone by forcing inactive.
  const rows = (await prisma.$queryRaw`
    UPDATE "ContractAmendment"
    SET "isActive" = false,
        "activatedAt" = NULL,
        "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING "id", "title", "content", "version", "isActive", "createdAt", "updatedAt", "activatedAt"
  `) as LegacyAmendmentRow[];
  const row = rows?.[0];
  if (!row?.id) return null;
  return { ...row, status: "DELETED" as const };
}

export async function legacyFindAmendmentById(id: string) {
  const rows = (await prisma.$queryRaw`
    SELECT "id", "title", "content", "version", "isActive", "createdAt", "updatedAt", "activatedAt"
    FROM "ContractAmendment"
    WHERE "id" = ${id}
    LIMIT 1
  `) as LegacyAmendmentRow[];
  const row = rows?.[0];
  if (!row?.id) return null;
  return { ...row, status: row.isActive ? ("ACTIVE" as const) : ("INACTIVE" as const) };
}

