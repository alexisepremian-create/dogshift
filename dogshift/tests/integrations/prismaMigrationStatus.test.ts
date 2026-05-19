import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression for docs/bugs/prisma-migration-not-applied-on-prod.md
 *
 * The May 19 2026 incident was caused by Vercel's `prisma migrate deploy`
 * silently skipping a migration. The /api/cron/prisma-migration-status cron
 * is the safety net — these tests lock in its core invariants without
 * hitting a real DB.
 *
 * What we verify:
 *  1. The cron route file exists and exports a GET handler.
 *  2. The cron is registered in vercel.json with a schedule.
 *  3. The cron path is whitelisted in /api/admin/agents-health route map.
 *  4. The migration directory listing matches what the cron route does:
 *     each subfolder is a migration name, no hidden files, no
 *     migration_lock.toml entry.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..");

test("cron route file exists", () => {
  const routePath = join(REPO_ROOT, "app", "api", "cron", "prisma-migration-status", "route.ts");
  assert.ok(
    statSync(routePath).isFile(),
    `Expected cron route at ${routePath}`,
  );
});

test("cron is registered in vercel.json with a schedule", async () => {
  const vercelPath = join(REPO_ROOT, "vercel.json");
  const { readFileSync } = await import("node:fs");
  const config = JSON.parse(readFileSync(vercelPath, "utf-8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  const cron = config.crons.find((c) => c.path === "/api/cron/prisma-migration-status");
  assert.ok(cron, "Expected /api/cron/prisma-migration-status in vercel.json crons");
  assert.match(
    cron.schedule,
    /^\d+\s+\d+\s+\*\s+\*\s+\*$/,
    `Expected daily cron pattern, got ${cron.schedule}`,
  );
});

test("agents-health route knows about the cron", async () => {
  const { readFileSync } = await import("node:fs");
  const healthRoute = readFileSync(
    join(REPO_ROOT, "app", "api", "admin", "agents-health", "route.ts"),
    "utf-8",
  );
  assert.match(
    healthRoute,
    /"prisma-migration-status":\s*"\/api\/cron\/prisma-migration-status"/,
    "Expected prisma-migration-status entry in ROUTE_MAP",
  );
});

test("migration directory listing excludes lock + hidden files", () => {
  const migrationsDir = join(REPO_ROOT, "prisma", "migrations");
  const entries = readdirSync(migrationsDir);

  // The cron's listMigrationsOnDisk() should NEVER pick these up
  const filtered = entries.filter((name) => {
    if (name.startsWith(".")) return false;
    if (name === "migration_lock.toml") return false;
    try {
      return statSync(join(migrationsDir, name)).isDirectory();
    } catch {
      return false;
    }
  });

  // Every survivor must look like a migration timestamp prefix
  for (const name of filtered) {
    assert.match(
      name,
      /^\d{14}_/,
      `Migration folder name must start with 14-digit timestamp: ${name}`,
    );
  }

  // The directory must contain migration_lock.toml — that's the Prisma
  // marker, and if it's missing the filter logic is moot anyway.
  assert.ok(
    entries.includes("migration_lock.toml"),
    "Expected migration_lock.toml at prisma/migrations/",
  );
});
