// The breeding feature is a native-only client screen with its own spinner;
// keep this Suspense fallback null so the e2e smoke test never waits on it
// (see docs/bugs/e2e-smoke-body-text-too-short.md).
export default function Loading() {
  return null;
}
