/**
 * Sitter detail loading state.
 *
 * Same rationale as `app/(marketing)/loading.tsx`: a fullscreen `<PageLoader>`
 * during an SSR bailout covers the page header for several seconds and reads
 * as "infinite loading" on slow mobile. Returning `null` lets the surrounding
 * marketing layout (header/footer) render immediately and the sitter content
 * fills in as soon as hydration completes.
 */
export default function Loading() {
  return null;
}
