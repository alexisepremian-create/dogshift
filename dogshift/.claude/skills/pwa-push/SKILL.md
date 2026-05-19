---
name: pwa-push
description: Configure or debug Web Push Notifications in DogShift (VAPID keys, service worker, subscription handling, sendPushToUser). Use when adding push notifications to a new event, debugging "user not receiving pushes", or modifying lib/push/.
---

# PWA Web Push — DogShift

## Stack

- **Library** : `web-push` (server) + native browser ServiceWorker (client)
- **Sender** : `lib/push/send.ts` — `sendPushToUser(userId, payload)`
- **Storage** : `PushSubscription` Prisma model (keyed by `userId` + endpoint hash)
- **Service worker** : `public/sw.js` (handles `push` + `notificationclick`)

## VAPID keys

Generate once :
```bash
npx web-push generate-vapid-keys
```

Store in Vercel env :
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (exposed to browser, used in `subscribe()`)
- `VAPID_PRIVATE_KEY` (server-only)
- `VAPID_SUBJECT` (defaults to `mailto:support@dogshift.ch`)

The lib lazily initializes on first send — no module-level side effects.

## Subscribe flow (client)

```ts
// 1. Register service worker
const registration = await navigator.serviceWorker.register("/sw.js");

// 2. Request permission
const permission = await Notification.requestPermission();
if (permission !== "granted") return;

// 3. Subscribe
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
});

// 4. Persist server-side
await fetch("/api/push/subscribe", {
  method: "POST",
  body: JSON.stringify(subscription.toJSON()),
});
```

## Send flow (server)

```ts
import { sendPushToUser } from "@/lib/push/send";

await sendPushToUser(userId, {
  title: "Nouvelle demande de garde",
  body: "Alice te demande pour vendredi 14h",
  url: "/host/requests/abc123",
  tag: "request-abc123",  // dedupe key
});
```

Returns `{ sent, failed }`. Failed sends with 410/404 indicate dead subscriptions → cleaned up.

## Discipline

- **Awaited in crons** (Vercel kills fire-and-forget)
- **Fire-and-forget in user-facing routes** (`.catch(() => {})`)
- Persist `details.pushSent` to `AgentLog` for audit when relevant
- One push per logical event (use `tag` to dedupe — replaces same-tag notif)

## Service worker (`public/sw.js`)

Handles two events :
- `push` : displays `event.data.json()` payload
- `notificationclick` : opens `payload.url` (focus existing tab if open)

The SW is registered at `/sw.js` (no scope prefix) → covers the whole site.

## Permission UX

Don't request permission on page load — it gets denied 90 % of the time. Trigger after a meaningful user action :

- Sitter just published their profile → "Veux-tu être notifié des demandes ?"
- Owner just created an account → "Active les rappels de booking"

Show a custom in-app prompt first, request native permission only after user clicks "yes".

## When push doesn't arrive

Checklist :

1. **Browser support** : Safari iOS requires "Add to Home Screen" + iOS 16.4+
2. **Permission granted** : `Notification.permission === "granted"` ?
3. **Service worker registered** : DevTools → Application → Service Workers
4. **Subscription persisted** : `SELECT * FROM "PushSubscription" WHERE "userId" = '...'`
5. **VAPID keys match** : browser subscription's `applicationServerKey` must match server-side VAPID_PUBLIC_KEY (mismatched keys = silent fail)
6. **Subscription still valid** : 410 from FCM/APN = expired, gets cleaned up automatically

## Anti-patterns

- ❌ Request permission on page load — denial rate kills future opportunities
- ❌ Send a push for every minor event — users disable notifications
- ❌ Forget the `tag` → users see N copies of the same notif
- ❌ Block a user request waiting on push delivery
- ❌ Send sensitive content in the notification body (lock screen visible)
- ❌ Rotate VAPID keys without warning — invalidates ALL existing subscriptions
- ❌ Hardcode push triggers in route handlers — use the agent layer (`/api/agents/notification`) to keep separation

## Cleanup

`sendPushToUser` auto-removes subscriptions that fail with 410 Gone or 404 Not Found. No manual cleanup needed for that case.

For inactive users (no login > 6 months), add to a scheduled cleanup job. Currently no such cron — candidate for future.

## Where to look

- `lib/push/send.ts` — sender (VAPID init, error handling, dead-sub cleanup)
- `public/sw.js` — service worker
- `app/api/push/subscribe/route.ts` — subscription endpoint
- `app/api/agents/notification/route.ts` — agent that orchestrates "send push for event X"
- `prisma/schema.prisma` → `PushSubscription` model

## Env vars

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@dogshift.ch
```
