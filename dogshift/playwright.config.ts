import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// Dummy env vars — just enough for `next start` to boot without real secrets.
// Keep these aligned with the CI build step in .github/workflows/ci.yml.
const dummyServerEnv: Record<string, string> = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db?schema=public",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/db?schema=public",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_ZHVtbXkuY2xlcmsuYWNjb3VudHMuZGV2JA",
  CLERK_SECRET_KEY: "sk_test_dummy",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  STRIPE_PUBLISHABLE_KEY: "pk_test_dummy",
  STRIPE_WEBHOOK_SECRET: "whsec_dummy",
  NEXT_PUBLIC_MAPTILER_KEY: "dummy",
  NEXT_PUBLIC_APP_URL: BASE_URL,
  CONTRACT_TOKEN_SECRET: "dummy",
  NEXTAUTH_SECRET: "dummy",
  NEXTAUTH_URL: BASE_URL,
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: dummyServerEnv,
  },
});
