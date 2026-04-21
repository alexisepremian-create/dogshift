import { expect, test } from "@playwright/test";

// Stripe regression tests.
// These lock in the minimal Stripe integration: payment pages must render
// without a 500, and the webhook endpoint must reject invalid signatures
// properly (not crash with a 500).
//
// We do NOT test a full payment flow here — that would require Stripe test
// card data and a real booking, which is covered by manual QA before each
// major release. What we lock in is that nothing is structurally broken.

// Payment result pages are public — they only need a bookingId query param.
// Without a valid bookingId they should show an error UI, not a 500.
const PAYMENT_RESULT_PAGES = [
  { path: "/paiement/success?bookingId=test-nonexistent-id", name: "payment success" },
  { path: "/paiement/failed?bookingId=test-nonexistent-id", name: "payment failed" },
  { path: "/paiement/cancel?bookingId=test-nonexistent-id", name: "payment cancel" },
  { path: "/paiement/retour?bookingId=test-nonexistent-id", name: "payment retour" },
] as const;

for (const route of PAYMENT_RESULT_PAGES) {
  test(`${route.name} page renders without 500`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();

    const status = response!.status();
    expect(
      status,
      `${route.path} must not return a 500 — got ${status}`,
    ).toBeLessThan(500);

    await expect(page.locator("body")).toBeVisible();
  });
}

test("checkout page with unknown bookingId shows an error, not a 500", async ({ page }) => {
  // The checkout page loads booking data client-side. With an invalid ID it
  // should render an error state, not crash the server or throw unhandled
  // exceptions that would blank the page.
  const response = await page.goto("/checkout/nonexistent-booking-id-xyz", {
    waitUntil: "domcontentloaded",
  });
  expect(response).not.toBeNull();
  expect(
    response!.status(),
    `checkout page must not return a 5xx — got ${response!.status()}`,
  ).toBeLessThan(500);

  await expect(page.locator("body")).toBeVisible();

  const bodyText = (await page.locator("body").innerText()).trim();
  // The page must render *something* — not a blank white screen.
  expect(bodyText.length, "checkout page must not be blank").toBeGreaterThan(10);
});

test("POST /api/webhooks/stripe with invalid signature returns 400, not 500", async ({
  request,
}) => {
  const response = await request.post("/api/webhooks/stripe", {
    data: '{"type":"test"}',
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": "t=invalid,v1=invalidsig",
    },
    failOnStatusCode: false,
  });

  // An invalid signature must return 400 (bad request), not 500 (crash).
  // A 500 here means the webhook handler threw an uncaught error — which
  // would also cause legitimate Stripe webhooks to fail silently.
  const status = response.status();
  expect(
    status,
    `POST /api/webhooks/stripe with invalid signature returned ${status}, expected 400`,
  ).toBe(400);
});

test("Stripe publishable key is present on the checkout page (client config check)", async ({
  page,
}) => {
  // Navigate to the checkout page — even with a fake booking ID, the page
  // HTML should include the Stripe publishable key somewhere in the JS
  // bundle or inline script, confirming it is configured in the deployment.
  await page.goto("/checkout/nonexistent-booking-id-xyz", { waitUntil: "domcontentloaded" });

  // Listen for Stripe.js to be loaded from Stripe's CDN — this confirms
  // the Stripe publishable key is wired up on the client.
  // We check via network request OR by checking the page source contains
  // the key prefix.
  const html = await page.content();
  const hasStripeKey =
    html.includes("pk_live_") ||
    html.includes("pk_test_") ||
    // Stripe.js loaded as a script tag
    html.includes("js.stripe.com");

  expect(
    hasStripeKey,
    "Expected Stripe publishable key or Stripe.js to be present on the checkout page. " +
      "This may mean STRIPE_PUBLISHABLE_KEY is not set in the deployment.",
  ).toBe(true);
});
