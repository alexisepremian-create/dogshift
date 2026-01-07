import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

function normalizeEmail(email: string) {
  return email.replace(/\s+/g, "+").trim().toLowerCase();
}

function hashToken(rawToken: string, secret: string) {
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

function tokenFingerprint(token: string) {
  try {
    const crypto = require("crypto") as typeof import("crypto");
    return crypto.createHash("sha256").update(token).digest("hex").slice(0, 10);
  } catch {
    return "unknown";
  }
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const sp = await Promise.resolve(searchParams);
  const tokenParam = sp?.token;
  const rawToken = Array.isArray(tokenParam) ? (tokenParam[0] ?? "") : tokenParam ?? "";
  const token = rawToken.trim();

  const emailParam = sp?.email;
  const emailRaw = Array.isArray(emailParam) ? (emailParam[0] ?? "") : emailParam ?? "";
  const email = normalizeEmail(emailRaw);
  const fp = token ? tokenFingerprint(token) : "missing";

  if (!token) {
    console.warn("[email-verification] confirm refused: missing_token");
    console.warn("[email-verification] redirect => /account/settings?verified=0");
    redirect("/account/settings?verified=0");
  }

  if (!email) {
    console.warn("[email-verification] confirm refused: missing_email", { fp });
    console.warn("[email-verification] redirect => /account/settings?verified=0");
    redirect("/account/settings?verified=0");
  }

  const secret = process.env.NEXTAUTH_SECRET || "";
  if (!secret) {
    console.error("[email-verification] confirm refused: missing_secret");
    console.warn("[email-verification] redirect => /account/settings?verified=0");
    redirect("/account/settings?verified=0");
  }

  const hashed = hashToken(token, secret);

  const record = await prisma.verificationToken.findFirst({
    where: {
      token: hashed,
      identifier: email,
    },
  });

  if (!record) {
    const user = await prisma.user.findUnique({ where: { email }, select: { emailVerified: true } });
    if (user?.emailVerified) {
      console.info("[email-verification] confirm refused: already_used", { fp, email });
      console.info("[email-verification] redirect => /account/settings?verified=1");
      redirect("/account/settings?verified=1");
    }

    console.warn("[email-verification] confirm refused: not_found", { fp, email });
    console.warn("[email-verification] redirect => /account/settings?verified=0");
    redirect("/account/settings?verified=0");
  }

  const expires = record.expires instanceof Date ? record.expires.getTime() : new Date(record.expires).getTime();
  if (!Number.isFinite(expires) || Date.now() > expires) {
    await prisma.verificationToken.deleteMany({ where: { token: hashed } });
    console.warn("[email-verification] confirm refused: expired", { fp, email: String(record.identifier ?? "") });
    console.warn("[email-verification] redirect => /account/settings?verified=0");
    redirect("/account/settings?verified=0");
  }

  const recordEmail = normalizeEmail(String(record.identifier ?? ""));
  if (!recordEmail) {
    await prisma.verificationToken.deleteMany({ where: { token: hashed } });
    console.warn("[email-verification] confirm refused: missing_identifier", { fp });
    console.warn("[email-verification] redirect => /account/settings?verified=0");
    redirect("/account/settings?verified=0");
  }

  if (recordEmail !== email) {
    console.warn("[email-verification] confirm refused: email_mismatch", { fp, recordEmail, email });
    console.warn("[email-verification] redirect => /account/settings?verified=0");
    redirect("/account/settings?verified=0");
  }

  await prisma.user.updateMany({
    where: { email },
    data: { emailVerified: new Date() },
  });

  await prisma.verificationToken.deleteMany({ where: { token: hashed } });

  console.info("[email-verification] confirm success", { fp, email });

  console.info("[email-verification] redirect => /account/settings?verified=1");

  redirect("/account/settings?verified=1");
}
