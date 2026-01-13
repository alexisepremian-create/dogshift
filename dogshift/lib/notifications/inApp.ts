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
  const hasSitterProfile = Boolean(
    await (prisma as any).sitterProfile.findUnique({ where: { userId }, select: { userId: true } })
  );
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
      metadata: true,
      createdAt: true,
      readAt: true,
    },
  });

  const baseUrl = hasSitterProfile ? "/host/messages/" : "/account/messages/";

  const resolveFromName = async (conversationId: string) => {
    try {
      const c = await (prisma as any).conversation.findUnique({
        where: { id: conversationId },
        select: {
          owner: { select: { name: true } },
          sitter: { select: { name: true, user: { select: { name: true } } } },
        },
      });
      if (!c) return null;
      if (hasSitterProfile) {
        const ownerName = typeof c?.owner?.name === "string" && c.owner.name.trim() ? c.owner.name.trim() : null;
        return ownerName;
      }
      const sitterName =
        (typeof c?.sitter?.user?.name === "string" && c.sitter.user.name.trim() ? c.sitter.user.name.trim() : null) ??
        (typeof c?.sitter?.name === "string" && c.sitter.name.trim() ? c.sitter.name.trim() : null);
      return sitterName;
    } catch {
      return null;
    }
  };

  const out: any[] = [];
  for (const n of items as any[]) {
    const type = String(n.type);
    const entityId = typeof n.entityId === "string" ? n.entityId : null;
    const metadata = n?.metadata && typeof n.metadata === "object" ? (n.metadata as Record<string, unknown>) : null;
    const metaConversationId = typeof metadata?.conversationId === "string" ? (metadata!.conversationId as string) : null;
    const conversationId = entityId ?? metaConversationId;

    let title = String(n.title ?? "");
    let url = typeof n.url === "string" ? n.url : null;
    let body = typeof n.body === "string" ? n.body : null;

    if (type === "newMessages" && conversationId) {
      if (!url || url.startsWith("/host/messages?") || url.startsWith("/account/messages?")) {
        url = `${baseUrl}${encodeURIComponent(conversationId)}`;
      }

      const metaFromName = typeof metadata?.fromName === "string" ? (metadata!.fromName as string) : "";
      const inferred = metaFromName.trim() ? metaFromName.trim() : await resolveFromName(conversationId);

      // Never show message preview in the notifications dropdown.
      body = null;

      // Always show the sender name next to "Nouveau message" when available.
      title = inferred ? `Nouveau message — ${inferred}` : "Nouveau message";
    }

    out.push({
      id: String(n.id),
      type,
      title,
      body,
      url,
      entityId,
      createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : new Date(n.createdAt).toISOString(),
      readAt: n.readAt instanceof Date ? n.readAt.toISOString() : n.readAt ? new Date(n.readAt).toISOString() : null,
    });
  }

  return out;
}

export async function markAllRead(userId: string) {
  const res = await (prisma as any).notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return Number(res?.count ?? 0);
}
