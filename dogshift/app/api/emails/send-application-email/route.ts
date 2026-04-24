import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { render } from "@react-email/render";

import { sendEmail } from "@/lib/email/sendEmail";
import {
  ApplicationStatusEmail,
  applicationStatusEmailPlainText,
  applicationStatusEmailSubject,
} from "@/lib/email/templates/applicationStatusEmail";
import { reportApiError } from "@/lib/observability/reportApiError";
import { baseUrlFromRequest } from "@/lib/url/baseUrlFromRequest";
import { zodParse } from "@/lib/validators/common";
import { sendApplicationEmailSchema } from "@/lib/sitterApplication/sendApplicationEmailSchema";
import { sendInterviewEmail } from "@/lib/sitterApplication/sendInterviewEmail";

export const runtime = "nodejs";

const ROUTE = "emails.send-application-email";

/**
 * Reads the webhook secret from the incoming request.
 *
 * Accepts either `x-webhook-secret: <secret>` or `Authorization: Bearer <secret>`,
 * matching the pattern used by the cron endpoints so n8n workflows can use
 * whichever is easier to configure.
 */
function readWebhookSecret(req: NextRequest): string {
  const header = (req.headers.get("x-webhook-secret") || "").trim();
  if (header) return header;

  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  return "";
}

export async function POST(req: NextRequest) {
  // ---------------------------------------------------------------------------
  // 1. Webhook auth
  // ---------------------------------------------------------------------------
  const configuredSecret = (process.env.N8N_WEBHOOK_SECRET || "").trim();
  if (!configuredSecret) {
    console.error("[api][emails][send-application-email] N8N_WEBHOOK_SECRET missing");
    return NextResponse.json(
      { success: false, error: "MISSING_N8N_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const providedSecret = readWebhookSecret(req);
  if (!providedSecret || providedSecret !== configuredSecret) {
    reportApiError({
      kind: "unauthorized",
      code: "UNAUTHORIZED",
      route: ROUTE,
      extra: { hasHeader: Boolean(providedSecret) },
    });
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // ---------------------------------------------------------------------------
  // 2. Body parsing + validation
  // ---------------------------------------------------------------------------
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    reportApiError({ kind: "validation_error", code: "INVALID_JSON", route: ROUTE });
    return NextResponse.json({ success: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = zodParse(sendApplicationEmailSchema, rawBody, { route: ROUTE });
  if (!parsed.ok) return parsed.response;

  const { firstName, lastName, email, status, score, calendlyLink, applicationId } = parsed.data;

  // ---------------------------------------------------------------------------
  // 3. Render + send
  // ---------------------------------------------------------------------------
  try {
    const baseUrl = baseUrlFromRequest(req) || "https://www.dogshift.ch";

    // HIGH flows through the shared helper so the admin-triggered path and the
    // n8n-triggered path stay in perfect sync (same template, same tracking on
    // acceptedEmailSentAt/acceptedEmailSource).
    if (status === "HIGH") {
      const result = await sendInterviewEmail({
        firstName,
        lastName,
        email,
        calendlyLink: calendlyLink ?? "",
        baseUrl,
        applicationId: applicationId ?? null,
        source: "n8n",
      });

      console.log("[api][emails][send-application-email] sent", {
        to: email,
        status,
        score,
        mode: result.mode,
        messageId: result.messageId,
        applicationId: applicationId ?? null,
        acceptedEmailSentAt: result.acceptedEmailSentAt?.toISOString() ?? null,
      });

      return NextResponse.json(
        {
          success: true,
          status,
          mode: result.mode,
          messageId: result.messageId,
        },
        { status: 200 }
      );
    }

    const subject = applicationStatusEmailSubject(status);
    const text = applicationStatusEmailPlainText({ firstName, lastName, status, calendlyLink });
    const html = await render(
      ApplicationStatusEmail({
        baseUrl,
        firstName,
        lastName,
        status,
        calendlyLink,
      })
    );

    const result = await sendEmail({ to: email, subject, text, html });

    console.log("[api][emails][send-application-email] sent", {
      to: email,
      status,
      score,
      mode: result.mode,
      messageId: result.messageId,
    });

    return NextResponse.json(
      {
        success: true,
        status,
        mode: result.mode,
        messageId: result.messageId ?? null,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[api][emails][send-application-email] error", { message, status, email });
    reportApiError({
      kind: "upstream_error",
      code: "EMAIL_SEND_FAILED",
      route: ROUTE,
      extra: { status, message },
    });
    return NextResponse.json(
      { success: false, error: "EMAIL_SEND_FAILED" },
      { status: 500 }
    );
  }
}
