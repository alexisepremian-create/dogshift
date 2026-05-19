---
name: email-template
description: Create or modify a transactional email template in DogShift (React Email + Resend primary / SMTP fallback). Use when adding a new email, redesigning an existing one, or debugging a delivery issue. Always work through lib/email/ — never bolt on an HTTP route or external service.
---

# Email templates — DogShift

## Stack

- **Templates** : React Email (.tsx) in `lib/email/templates/`
- **Sender** : `lib/email/sendEmail.ts` — `sendEmail({ to, subject, text, html })`
- **Primary** : Resend (`RESEND_API_KEY`)
- **Fallback** : SMTP (`SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`)
- **Dev** : `console.log` if neither is configured

## Pattern : creating a new template

1. Create `lib/email/templates/<name>Email.tsx`:

```tsx
import { renderEmailLayout } from "./layout";

export function render<Name>Email(params: { firstName: string; ctaUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const { firstName, ctaUrl } = params;
  const subject = `…`;
  const html = renderEmailLayout({
    title: subject,
    intro: `Bonjour ${firstName},`,
    body: `<p>…</p>`,
    cta: { url: ctaUrl, label: "…" },
  });
  const text = `Bonjour ${firstName},\n\n…\n\n${ctaUrl}`;
  return { subject, html, text };
}
```

2. Call it inline at the trigger point:

```ts
import { sendEmail } from "@/lib/email/sendEmail";
import { renderXxxEmail } from "@/lib/email/templates/xxxEmail";

const { subject, html, text } = renderXxxEmail({ firstName, ctaUrl });
await sendEmail({ to: user.email, subject, html, text });
```

3. Update `docs/emails/EMAIL_CATALOG.md` with the new trigger.

## What NOT to do

- ❌ **Don't add new `/api/email/*` HTTP routes.** Those were a relic of the n8n era (removed PR #337). Always call the lib function inline.
- ❌ Don't render React Email at the call site without `renderEmailLayout()` — it ensures consistent DogShift branding (header, footer, button styles).
- ❌ Don't send to `user.email` without verifying `emailVerified` for transactional flows that could be abused (e.g. password reset on unverified accounts).
- ❌ Don't include sensitive info in URL query params (cookies/logs/referrers leak). Pass via authenticated routes only.

## French copy rules

- User-facing copy is **French (fr-CH)** — DogShift is French-only by design.
- No i18n library. Strings are inlined.
- Tutoyer ou vouvoyer ? **Tutoyer** par défaut sur DogShift (ton chaleureux, communauté pet-sitting).
- Date format : `formatDateFR()` from `lib/telegram/format.ts` works for emails too (`"19 mai 2026"`).

## Testing

Render once locally before shipping:

```bash
npx tsx --env-file=.env.local -e "
import { renderXxxEmail } from './lib/email/templates/xxxEmail';
const r = renderXxxEmail({ firstName: 'Test', ctaUrl: 'https://www.dogshift.ch/test' });
console.log('SUBJECT:', r.subject);
console.log('TEXT:', r.text);
require('fs').writeFileSync('/tmp/email.html', r.html);
console.log('HTML written to /tmp/email.html — open in browser');
"
open /tmp/email.html
```

Add a snapshot test in `tests/emails/` :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderXxxEmail } from "@/lib/email/templates/xxxEmail";

test("renderXxxEmail returns subject + html + text", () => {
  const r = renderXxxEmail({ firstName: "Alice", ctaUrl: "https://x" });
  assert.ok(r.subject.length > 0);
  assert.ok(r.html.includes("Alice"));
  assert.ok(r.html.includes("https://x"));
  assert.ok(r.text.includes("Alice"));
});
```

## Sending discipline

- **User-facing routes** : `void sendEmail(...).catch(() => {})` — never block on email delivery
- **Crons** : `await sendEmail(...)` — Vercel kills fire-and-forget after `return NextResponse.json(...)`
- Persist `details.emailSent` to `AgentLog` for audit when relevant

## Where to look

- Catalog of every email currently sent : `docs/emails/EMAIL_CATALOG.md`
- Full system doc : `docs/emails/EMAIL_SYSTEM.md` — **READ FIRST** before touching any email
- Existing templates : `lib/email/templates/*.tsx` — copy the closest one as starting point
