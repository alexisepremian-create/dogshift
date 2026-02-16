import { prisma } from "@/lib/prisma";

export type AvailabilityAuditAction =
  | "UPSERT_CONFIG"
  | "REPLACE_RULES"
  | "UPSERT_EXCEPTION"
  | "DELETE_EXCEPTION";

export async function writeAvailabilityAuditLog(input: {
  sitterId: string;
  actorUserId: string;
  action: AvailabilityAuditAction;
  serviceType?: "PROMENADE" | "DOGSITTING" | "PENSION" | null;
  dateKey?: string | null;
  payloadSummary?: unknown;
}) {
  const sitterId = input.sitterId;
  const actorUserId = input.actorUserId;
  if (!sitterId || !actorUserId) return;

  await (prisma as any).availabilityAuditLog.create({
    data: {
      sitterId,
      actorUserId,
      action: input.action,
      serviceType: input.serviceType ?? null,
      dateKey: input.dateKey ?? null,
      payloadSummary: (input.payloadSummary ?? null) as any,
    },
  });
}
