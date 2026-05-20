/**
 * Unified push dispatcher.
 *
 * A single call to `sendPushToUserAllChannels(userId, payload)` fans out to
 * Web Push (VAPID) + APNs (iOS) + FCM (Android), so each registered device
 * receives the notification regardless of how it subscribed.
 *
 * The two underlying senders auto-clean their dead subscriptions, so we
 * don't worry about it here.
 *
 * Why a wrapper : existing callers that use `sendPushToUser()` (web only)
 * shouldn't change. New native-aware crons / agents should call this one.
 */

import { sendPushToUser, type PushPayload } from "./send";
import { sendNativePushToUser, type NativePushPayload } from "./native";

export type UnifiedPushPayload = PushPayload & {
  /** Deep link URL — used by both web push (url) and native (url claim). */
  url?: string;
};

export async function sendPushToUserAllChannels(
  userId: string,
  payload: UnifiedPushPayload,
): Promise<{ web: { sent: number; failed: number }; ios: number; android: number; nativeFailed: number }> {
  // Web Push (VAPID) — existing flow
  const web = await sendPushToUser(userId, payload).catch(() => ({ sent: 0, failed: 0 }));

  // Native (APNs + FCM)
  const nativePayload: NativePushPayload = {
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    data: payload.data,
  };
  const native = await sendNativePushToUser(userId, nativePayload).catch(() => ({ ios: 0, android: 0, failed: 0 }));

  return {
    web: { sent: web.sent, failed: web.failed },
    ios: native.ios,
    android: native.android,
    nativeFailed: native.failed,
  };
}
