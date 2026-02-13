import { prisma } from "@/lib/prisma";

export type NotificationKey =
  | "newMessages"
  | "newBookingRequest"
  | "bookingConfirmed"
  | "paymentReceived"
  | "bookingReminder"
  | "bookingCancelled"
  | "bookingRefunded"
  | "bookingRefundFailed";

export type NotificationPrefs = Record<NotificationKey, boolean>;

function defaultNotificationPrefs(): NotificationPrefs {
  return {
    newMessages: true,
    newBookingRequest: true,
    bookingConfirmed: true,
    paymentReceived: true,
    bookingReminder: true,
    bookingCancelled: true,
    bookingRefunded: true,
    bookingRefundFailed: true,
  };
}

function safeJsonParse(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function readNotificationPrefsFromHostProfileJson(hostProfileJson: string | null): NotificationPrefs {
  const defaults = defaultNotificationPrefs();
  const parsed = safeJsonParse(hostProfileJson);
  const notifications = parsed?.accountSettings?.notifications;
  return {
    newMessages: typeof notifications?.newMessages === "boolean" ? notifications.newMessages : defaults.newMessages,
    newBookingRequest:
      typeof notifications?.newBookingRequest === "boolean" ? notifications.newBookingRequest : defaults.newBookingRequest,
    bookingConfirmed:
      typeof notifications?.bookingConfirmed === "boolean" ? notifications.bookingConfirmed : defaults.bookingConfirmed,
    paymentReceived:
      typeof notifications?.paymentReceived === "boolean" ? notifications.paymentReceived : defaults.paymentReceived,
    bookingReminder:
      typeof notifications?.bookingReminder === "boolean" ? notifications.bookingReminder : defaults.bookingReminder,
    bookingCancelled:
      typeof notifications?.bookingCancelled === "boolean" ? notifications.bookingCancelled : defaults.bookingCancelled,
    bookingRefunded:
      typeof notifications?.bookingRefunded === "boolean" ? notifications.bookingRefunded : defaults.bookingRefunded,
    bookingRefundFailed:
      typeof notifications?.bookingRefundFailed === "boolean" ? notifications.bookingRefundFailed : defaults.bookingRefundFailed,
  };
}

function readNotificationLogFromHostProfileJson(hostProfileJson: string | null) {
  const parsed = safeJsonParse(hostProfileJson);
  const log = parsed?.accountSettings?.notificationLog;
  return log && typeof log === "object" ? (log as Record<string, unknown>) : {};
}

export async function shouldSendUserNotification(userId: string, key: NotificationKey) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, hostProfileJson: true },
  });
  if (!user) return false;
  const prefs = readNotificationPrefsFromHostProfileJson(user.hostProfileJson);
  return Boolean(prefs[key]);
}

export async function hasNotificationAlreadySent(userId: string, key: NotificationKey, entityId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, hostProfileJson: true },
  });
  if (!user) return true;

  const log = readNotificationLogFromHostProfileJson(user.hostProfileJson);
  const bucket = log[key];
  if (!bucket || typeof bucket !== "object") return false;
  return typeof (bucket as any)[entityId] === "string";
}

export async function markNotificationSent(userId: string, key: NotificationKey, entityId: string, sentAtIso: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, hostProfileJson: true },
  });
  if (!user) return;

  const parsed = safeJsonParse(user.hostProfileJson) ?? {};
  const accountSettings = parsed?.accountSettings && typeof parsed.accountSettings === "object" ? parsed.accountSettings : {};
  const existingLog =
    accountSettings?.notificationLog && typeof accountSettings.notificationLog === "object" ? accountSettings.notificationLog : {};
  const bucket = existingLog?.[key] && typeof existingLog[key] === "object" ? existingLog[key] : {};

  const next = {
    ...(parsed && typeof parsed === "object" ? parsed : {}),
    accountSettings: {
      ...(accountSettings && typeof accountSettings === "object" ? accountSettings : {}),
      notificationLog: {
        ...(existingLog && typeof existingLog === "object" ? existingLog : {}),
        [key]: {
          ...(bucket && typeof bucket === "object" ? bucket : {}),
          [entityId]: sentAtIso,
        },
      },
    },
  };

  await prisma.user.update({
    where: { id: userId },
    data: { hostProfileJson: JSON.stringify(next) },
    select: { id: true },
  });
}
