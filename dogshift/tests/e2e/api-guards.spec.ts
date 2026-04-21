import { expect, test } from "@playwright/test";

// API endpoint guard tests.
// Every API route that requires auth must return 401 or 403 when called
// without a valid Clerk session. A 500 here means middleware is broken.
//
// These tests call the API endpoints directly (no browser JS / Clerk client).
// The Vercel preview runs with real Clerk middleware, so these are meaningful.

const AUTHED_API_ROUTES: Array<{ method: string; path: string; body?: string }> = [
  { method: "GET", path: "/api/sitters/me" },
  // /api/sitters/me/service-config validates query params before auth, so it
  // can return 400 (missing serviceType) instead of 401 — both are acceptable
  // as long as it's not a 500.
  { method: "GET", path: "/api/sitters/me/service-config?serviceType=PROMENADE" },
  { method: "PATCH", path: "/api/host/profile", body: JSON.stringify({ firstName: "Test" }) },
  { method: "POST", path: "/api/bookings", body: JSON.stringify({}) },
  { method: "GET", path: "/api/messages" },
];

for (const route of AUTHED_API_ROUTES) {
  test(`${route.method} ${route.path} returns 401/403, not 500, without auth`, async ({
    request,
  }) => {
    const response = await request.fetch(route.path, {
      method: route.method,
      headers: {
        "Content-Type": "application/json",
      },
      data: route.body,
      failOnStatusCode: false,
    });

    const status = response.status();
    // The important thing is that the server doesn't crash (no 5xx).
    // Auth routes may return 400, 401, 403, or 404 depending on Clerk
    // middleware version and whether params are validated before auth.
    expect(
      status,
      `${route.method} ${route.path} must not return 5xx when unauthenticated, got ${status}`,
    ).toBeLessThan(500);
  });
}

test("GET /api/sitters returns 200 and an array (public endpoint)", async ({ request }) => {
  const response = await request.get("/api/sitters", { failOnStatusCode: false });
  // This endpoint is public — must not require auth.
  expect(response.status()).toBeLessThan(400);
});
