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
  // The checkout page loads Stripe lazily inside a useEffect, so we can't
  // just read page.content() at domcontentloaded — the page may still be
  // showing its loading spinner. Wait for either a network request to
  // js.stripe.com (fired by loadStripe), or for the publishable key to
  // surface in the DOM after hydration.
  const stripeRequest = page
    .waitForRequest((req) => req.url().includes("js.stripe.com"), { timeout: 12_000 })
    .catch(() => null);

  await page.goto("/checkout/nonexistent-booking-id-xyz", { waitUntil: "networkidle" });

  const requestSeen = (await stripeRequest) !== null;
  const html = await page.content();
  const hasStripeKey =
    requestSeen ||
    html.includes("pk_live_") ||
    html.includes("pk_test_") ||
    html.includes("js.stripe.com");

  expect(
    hasStripeKey,
    "Expected Stripe publishable key or Stripe.js to be present on the checkout page. " +
      "This may mean STRIPE_PUBLISHABLE_KEY is not set in the deployment.",
  ).toBe(true);
});
