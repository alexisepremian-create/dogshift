import { render } from "@react-email/render";

import { sendEmail } from "@/lib/email/sendEmail";
import {
  ApplicationStatusEmail,
  applicationStatusEmailPlainText,
  applicationStatusEmailSubject,
} from "@/lib/email/templates/applicationStatusEmail";
import { prisma } from "@/lib/prisma";

/**
 * Sends the "HIGH" / interview-booking email to a sitter candidate and, when
 * an `applicationId` is provided, records the emission on the associated
 * `PilotSitterApplication` row (`acceptedEmailSentAt` + `acceptedEmailSource`).
 *
 * Shared between:
 *  - The n8n scoring callback (`POST /api/emails/send-application-email`,
 *    source="n8n")
 *  - The manual admin action (`POST /api/admin/pilot-sitter-applications/
 *    send-interview-email`, source="admin")
 *
 * The DB update is best-effort: if it throws, the email is still considered
 * delivered and the caller receives the email result. We log the update error
 * and keep going so we never hide a successful delivery behind a tracking
 * glitch.
 */
export type InterviewEmailSource = "n8n" | "admin";

export type SendInterviewEmailParams = {
  firstName: string;
  lastName: string;
  email: string;
  calendlyLink: string;
  baseUrl: string;
  applicationId?: string | null;
  source: InterviewEmailSource;
};

export type SendInterviewEmailResult = {
  mode: string;
  messageId: string | null;
  acceptedEmailSentAt: Date | null;
};

export async function sendInterviewEmail(
  params: SendInterviewEmailParams,
): Promise<SendInterviewEmailResult> {
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const email = params.email.trim().toLowerCase();
  const calendlyLink = params.calendlyLink.trim();
  const baseUrl = params.baseUrl.trim().replace(/\/$/, "") || "https://www.dogshift.ch";

  const subject = applicationStatusEmailSubject("HIGH");
  const text = applicationStatusEmailPlainText({
    firstName,
    lastName,
    status: "HIGH",
    calendlyLink,
  });
  const html = await render(
    ApplicationStatusEmail({
      baseUrl,
      firstName,
      lastName,
      status: "HIGH",
      calendlyLink,
    }),
  );

  const delivery = await sendEmail({ to: email, subject, text, html });

  let acceptedEmailSentAt: Date | null = null;
  if (params.applicationId) {
    const now = new Date();
    try {
      await (prisma as unknown as {
        pilotSitterApplication: {
          update: (args: unknown) => Promise<{ id: string }>;
        };
      }).pilotSitterApplication.update({
        where: { id: params.applicationId },
        data: {
          acceptedEmailSentAt: now,
          acceptedEmailSource: params.source,
        },
        select: { id: true },
      });
      acceptedEmailSentAt = now;
    } catch (err) {
      console.error(
        "[sendInterviewEmail] failed to record acceptedEmailSentAt",
        {
          applicationId: params.applicationId,
          source: params.source,
          message: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  return {
    mode: delivery.mode,
    messageId: delivery.messageId ?? null,
    acceptedEmailSentAt,
  };
}
