/**
 * Sitter detail loading state.
 *
 * Returns `null` for the same reason as `app/(marketing)/loading.tsx`:
 * rendering <PageLoader static /> as the Suspense fallback caused the e2e
 * smoke test to hang on the Vercel preview (data takes >15 s to resolve,
 * Playwright sees only the loader). The sitter page renders its own
 * internal `<PageLoader static />` while `sitter === undefined` — that
 * still kicks in client-side, so the user experience past the initial
 * Suspense paint is unchanged.
 *
 * See docs/bugs/e2e-smoke-body-text-too-short.md.
 */
export default function Loading() {
  return null;
}
