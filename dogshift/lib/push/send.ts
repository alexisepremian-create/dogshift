/* eslint-disable @typescript-eslint/no-explicit-any */
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:support@dogshift.ch";

let vapidInitialised = false;
function ensureVapid() {
  if (vapidInitialised || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidInitialised = true;
}

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  ensureVapid();
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys not configured — skipping push notification");
    return { sent: 0, failed: 0 };
  }

  const subs = await (prisma as any).pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subs.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? "/pwa-icons/icon-192x192.png",
    badge: payload.badge ?? "/icons/badge-72.png",
    tag: payload.tag,
    data: { url: payload.url ?? "/", ...payload.data },
  });

  const results = await Promise.allSettled(
    subs.map((sub: { id: string; endpoint: string; p256dh: string; auth: string }) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 24 },
        )
        .catch(async (err: { statusCode?: number }) => {
          if (err?.statusCode === 410) {
            // Subscription expired — remove it
            await (prisma as any).pushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
          }
          throw err;
        }),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.error(`[push] sendPushToUser userId=${userId} sent=${sent} failed=${failed}`);
  }
  return { sent, failed };
}
