import { type FullConfig } from "@playwright/test";
import * as path from "node:path";

/**
 * Playwright global setup — DISABLED for the Clerk → Auth.js migration window.
 *
 * The previous version provisioned authenticated browser states via Clerk's
 * backend API. With Auth.js v5 (database sessions), there's no equivalent
 * "create a logged-in browser state from an API call" path because we don't
 * issue session tokens out-of-band.
 *
 * Authenticated e2e tests (dashboard.spec.ts) check for the existence of the
 * storage state files and skip themselves when they aren't present. Public
 * smoke tests, login form tests, signup tests, etc. don't need any setup
 * and continue to run.
 *
 * A real Auth.js-aware setup can be added later by either:
 *   a) Driving the UI login flow in Playwright (slow but realistic).
 *   b) Inserting a Session row directly via Prisma + setting the
 *      `authjs.session-token` cookie manually (fast but more brittle).
 */

export const SITTER_AUTH_FILE = path.join(__dirname, ".auth/sitter.json");
export const OWNER_AUTH_FILE = path.join(__dirname, ".auth/owner.json");

export default async function globalSetup(_config: FullConfig) {
  console.warn(
    "[global-setup] DISABLED during Clerk → Auth.js migration. Authenticated e2e tests will be skipped.",
  );
}
