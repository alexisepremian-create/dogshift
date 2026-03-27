import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

type DbClient = {
  $executeRawUnsafe: (query: string, ...values: any[]) => Promise<number>;
  $queryRawUnsafe: (query: string, ...values: any[]) => Promise<any>;
};

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

export const LEGACY_SOFT_DELETED_PREFIX = "[[SOFT_DELETED_AT:";

export async function legacyDeactivateAllActiveAmendments() {
  await legacyDeactivateAllActiveAmendmentsWithDb(prisma as any);
}

export async function legacyDeactivateAllActiveAmendmentsWithDb(db: DbClient) {
  const sql =
    'UPDATE "ContractAmendment" SET "isActive" = false, "activatedAt" = NULL, "updatedAt" = NOW() WHERE "isActive" = true';
  console.info("[contract-amendment][legacy-sql]", { op: "deactivate_all_active", sql });
  await db.$executeRawUnsafe(sql);
}

export async function legacyCreateAmendment(args: {
  title: string;
  content: string;
  version: string;
  isActive: boolean;
}) {
  return legacyCreateAmendmentWithDb(prisma as any, args);
}

export async function legacyCreateAmendmentWithDb(
  db: DbClient,
  args: { title: string; content: string; version: string; isActive: boolean },
) {
  const id = randomUUID();
  const sql =
    'INSERT INTO "ContractAmendment" ("id","title","content","version","isActive","activatedAt","updatedAt") ' +
    "VALUES ($1,$2,$3,$4,$5,CASE WHEN $5 THEN NOW() ELSE NULL END,NOW()) " +
    'RETURNING "id","title","content","version","isActive","createdAt","updatedAt","activatedAt"';
  const params = [id, args.title, args.content, args.version, args.isActive];
  console.info("[contract-amendment][legacy-sql]", {
    op: "create_amendment",
    sql,
    params: {
      id,
      titleLen: args.title.length,
      contentLen: args.content.length,
      version: args.version,
      isActive: args.isActive,
    },
  });
  let rows: LegacyAmendmentRow[];
  try {
    rows = (await db.$queryRawUnsafe(sql, ...params)) as LegacyAmendmentRow[];
  } catch (err) {
    console.error("[contract-amendment][legacy-sql][error]", {
      op: "create_amendment",
      message: (err as any)?.message ?? null,
      code: (err as any)?.code ?? null,
      meta: (err as any)?.meta ?? null,
      sql,
      version: args.version,
      isActive: args.isActive,
    });
    throw err;
  }

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
  const deletedMarker = `${LEGACY_SOFT_DELETED_PREFIX}${new Date().toISOString()}]]`;
  const rows = (await prisma.$queryRaw`
    UPDATE "ContractAmendment"
    SET "isActive" = false,
        "activatedAt" = NULL,
        "updatedAt" = NOW(),
        "content" = CASE
          WHEN position(${deletedMarker} in "content") = 1 THEN "content"
          ELSE (${deletedMarker} || E'\n' || "content")
        END
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

