import test from "node:test";
import assert from "node:assert/strict";

import {
  SERVICE_DISABLED,
  assertServiceEnabledOrThrow,
  ensureServiceConfigRow,
  isServiceEnabled,
  loadBookableServiceTypes,
} from "../../lib/availability/serviceActivation.ts";
import { resolvePublicEnabledServices } from "../../lib/sitterEnabledServices.ts";

/**
 * Regression coverage for the "Pension affichée mais aucune date dispo" bug
 * (Sonia Bürer, juillet 2026). See docs/bugs/service-availability-desync.md.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeServiceConfig(rows: Array<{ serviceType: string; enabled: boolean }>, created: any[]) {
  return {
    serviceConfig: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: async ({ where }: any) => {
        const serviceType = where?.sitterId_serviceType?.serviceType;
        return rows.find((r) => r.serviceType === serviceType) ?? null;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: async ({ data }: any) => {
        created.push(data);
        return data;
      },
    },
  };
}

test("isServiceEnabled: a missing row means enabled (matches the slot engine's `config?.enabled ?? true`)", () => {
  assert.equal(isServiceEnabled(null), true);
  assert.equal(isServiceEnabled(undefined), true);
  assert.equal(isServiceEnabled({}), true);
  assert.equal(isServiceEnabled({ enabled: true }), true);
  assert.equal(isServiceEnabled({ enabled: false }), false);
});

test("ensureServiceConfigRow: materializes the row with every required Int column", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created: any[] = [];
  const prisma = fakeServiceConfig([], created);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enabled = await ensureServiceConfigRow(prisma as any, "sitter_1", "PENSION");

  assert.equal(enabled, true);
  assert.equal(created.length, 1);
  // ServiceConfig has NO Prisma default for these — omitting even one made the
  // create branch throw and silently rolled back syncSitterServices.
  for (const column of [
    "slotStepMin",
    "minDurationMin",
    "maxDurationMin",
    "leadTimeMin",
    "bufferBeforeMin",
    "bufferAfterMin",
  ]) {
    assert.equal(typeof created[0][column], "number", `missing required column ${column}`);
  }
  assert.equal(created[0].sitterId, "sitter_1");
  assert.equal(created[0].serviceType, "PENSION");
});

test("assertServiceEnabledOrThrow: rejects availability writes on a disabled service", async () => {
  const prisma = fakeServiceConfig([{ serviceType: "PENSION", enabled: false }], []);
  await assert.rejects(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => assertServiceEnabledOrThrow(prisma as any, "sitter_1", "PENSION"),
    (err: Error) => err.message === SERVICE_DISABLED,
  );
});

test("assertServiceEnabledOrThrow: passes for an enabled service", async () => {
  const prisma = fakeServiceConfig([{ serviceType: "PROMENADE", enabled: true }], []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await assertServiceEnabledOrThrow(prisma as any, "sitter_1", "PROMENADE");
});

test("loadBookableServiceTypes: unions rules + upcoming exceptions, ignores UNAVAILABLE", async () => {
  const prisma = {
    availabilityRule: {
      groupBy: async () => [{ sitterId: "s1", serviceType: "PROMENADE" }],
    },
    availabilityException: {
      groupBy: async () => [{ sitterId: "s1", serviceType: "DOGSITTING" }],
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = await loadBookableServiceTypes(prisma as any, ["s1", "s2"]);
  assert.deepEqual([...(map.get("s1") ?? [])].sort(), ["DOGSITTING", "PROMENADE"]);
  assert.equal(map.get("s2"), undefined);
});

test("loadBookableServiceTypes: no sitters means no queries", async () => {
  const prisma = {
    availabilityRule: {
      groupBy: async () => {
        throw new Error("should not query");
      },
    },
    availabilityException: {
      groupBy: async () => {
        throw new Error("should not query");
      },
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = await loadBookableServiceTypes(prisma as any, []);
  assert.equal(map.size, 0);
});

test("resolvePublicEnabledServices: hides an activated service that has zero availability", () => {
  const params = {
    serviceConfigs: [
      { serviceType: "PROMENADE", enabled: true },
      { serviceType: "DOGSITTING", enabled: true },
      { serviceType: "PENSION", enabled: true },
    ],
    pricing: { Promenade: 25, Garde: 40, Pension: 60 },
    servicesJson: ["Promenade"],
  };

  // Without the filter: the exact prod state that made owners see "Pension"
  // and get UNAVAILABLE on every date.
  assert.deepEqual(resolvePublicEnabledServices(params), ["Promenade", "Garde", "Pension"]);

  assert.deepEqual(
    resolvePublicEnabledServices({ ...params, bookableServiceTypes: ["PROMENADE"] }),
    ["Promenade"],
  );
});

test("resolvePublicEnabledServices: an empty availability set hides every service", () => {
  assert.deepEqual(
    resolvePublicEnabledServices({
      serviceConfigs: [{ serviceType: "PENSION", enabled: true }],
      pricing: { Pension: 60 },
      servicesJson: ["Pension"],
      bookableServiceTypes: [],
    }),
    [],
  );
});
