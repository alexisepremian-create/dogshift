import { chromium, type FullConfig } from "@playwright/test";
import { createClerkClient } from "@clerk/backend";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Playwright global setup: creates an authenticated browser session for the
 * test sitter and test owner accounts using Clerk's backend API.
 *
 * Saves the browser storage state (cookies + localStorage) to disk so that
 * dashboard.spec.ts can reuse it without re-authenticating on every test.
 *
 * Requires env vars:
 *   CLERK_SECRET_KEY               — Clerk secret key for the prod/preview environment
 *   PLAYWRIGHT_BASE_URL            — URL of the app under test (e.g. Vercel preview URL)
 *   PLAYWRIGHT_SITTER_EMAIL        — email of the sitter test account
 *   PLAYWRIGHT_OWNER_EMAIL         — email of the owner test account
 *   VERCEL_AUTOMATION_BYPASS_SECRET — (optional) Vercel protection bypass secret
 *
 * If CLERK_SECRET_KEY is not set, auth setup is skipped and authenticated tests
 * will be skipped gracefully (they check for the state file at runtime).
 */

export const SITTER_AUTH_FILE = path.join(__dirname, ".auth/sitter.json");
export const OWNER_AUTH_FILE = path.join(__dirname, ".auth/owner.json");

export default async function globalSetup(_config: FullConfig) {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    console.warn("[global-setup] CLERK_SECRET_KEY not set — skipping auth setup. Authenticated tests will be skipped.");
    return;
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const sitterEmail = process.env.PLAYWRIGHT_SITTER_EMAIL;
  const ownerEmail = process.env.PLAYWRIGHT_OWNER_EMAIL;

  if (!sitterEmail || !ownerEmail) {
    console.warn("[global-setup] PLAYWRIGHT_SITTER_EMAIL or PLAYWRIGHT_OWNER_EMAIL not set — skipping auth setup.");
    return;
  }

  const clerk = createClerkClient({ secretKey: clerkSecretKey });
  fs.mkdirSync(path.dirname(SITTER_AUTH_FILE), { recursive: true });

  const browser = await chromium.launch();

  async function authenticateAccount(email: string, outputFile: string, label: string) {
    console.log(`[global-setup] Authenticating ${label} (${email})…`);

    // Look up the user by email address.
    const { data: users } = await clerk.users.getUserList({ emailAddress: [email] });
    const user = users[0];
    if (!user) {
      console.warn(`[global-setup] No Clerk user found for ${email} — skipping ${label} auth.`);
      return;
    }

    // Create a sign-in token (magic link that logs in without password/OTP).
    // This bypasses Clerk's "client trust" MFA requirement, making it safe for CI.
    const tokenResponse = await clerk.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: 120,
    });

    const tokenUrl = tokenResponse.url;
    if (!tokenUrl) {
      console.warn(`[global-setup] Could not get sign-in token URL for ${email}.`);
      return;
    }

    const context = await browser.newContext({
      baseURL,
      extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
        ? {
            "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
            "x-vercel-set-bypass-cookie": "samesitenone",
          }
        : undefined,
    });

    const page = await context.newPage();

    // The sign-in token URL may be on the Clerk accounts domain. We navigate to
    // it, Clerk sets the session cookie on our domain, then redirects to the app.
    await page.goto(tokenUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Wait to land somewhere in the app (not still on the token URL).
    await page.waitForURL((url) => !url.toString().includes("sign_in_tokens"), {
      timeout: 20_000,
    }).catch(() => {
      console.warn(`[global-setup] Still on token URL after 20s for ${email} — saving state anyway.`);
    });

    await context.storageState({ path: outputFile });
    console.log(`[global-setup] ✓ Auth state saved for ${label} → ${outputFile}`);
    await context.close();
  }

  try {
    await authenticateAccount(sitterEmail, SITTER_AUTH_FILE, "sitter");
    await authenticateAccount(ownerEmail, OWNER_AUTH_FILE, "owner");
  } finally {
    await browser.close();
  }
}
