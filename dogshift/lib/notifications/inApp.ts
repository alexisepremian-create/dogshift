import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "newMessages"
  | "newBookingRequest"
  | "paymentReceived"
  | "bookingConfirmed"
  | "bookingReminder";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityId?: string | null;
  url?: string | null;
  metadata?: Record<string, unknown> | null;
  idempotencyKey: string;
};

export async function createNotification(input: CreateNotificationInput) {
  try {
    const created = await (prisma as any).notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityId: input.entityId ?? null,
        url: input.url ?? null,
        metadata: input.metadata ?? null,
        idempotencyKey: input.idempotencyKey,
      },
      select: { id: true },
    });
    return { ok: true as const, id: String(created.id) };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return { ok: true as const, id: null as string | null, deduped: true as const };
    }
    throw err;
  }
}

export async function getUnreadCount(userId: string) {
  const total = await (prisma as any).notification.count({
    where: { userId, readAt: null },
  });
  return Number(total ?? 0);
}

export async function listNotifications(userId: string, limit: number) {
  const take = Math.max(1, Math.min(50, limit));
  const items = await (prisma as any).notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      url: true,
      entityId: true,
      createdAt: true,
      readAt: true,
    },
  });

  return (items as any[]).map((n) => ({
    id: String(n.id),
    type: String(n.type),
    title: String(n.title ?? ""),
    body: typeof n.body === "string" ? n.body : null,
    url: typeof n.url === "string" ? n.url : null,
    entityId: typeof n.entityId === "string" ? n.entityId : null,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : new Date(n.createdAt).toISOString(),
    readAt: n.readAt instanceof Date ? n.readAt.toISOString() : n.readAt ? new Date(n.readAt).toISOString() : null,
  }));
}

export async function markAllRead(userId: string) {
  const res = await (prisma as any).notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return Number(res?.count ?? 0);
}
