# Performance — Mobile Homepage Optimization

This document captures the root causes of severe mobile jank on the DogShift
homepage and the fixes applied (PRs #306–#309, May 2026). Use it as a
checklist when touching any homepage component.

---

## Golden Rules

1. **Never duplicate stateful components.** One instance = one set of hooks.
   Mounting two instances of a component with ~20 `useState` doubles all React
   work on every re-render.
2. **Never use `backdrop-blur` on mobile-visible elements.** It forces the GPU
   to sample and blur every pixel behind the element on every frame. Use solid
   backgrounds or `radial-gradient` for glow effects.
3. **Never animate layout properties** (`left`, `top`, `width`, `height`).
   These trigger layout recalculation on every frame. Use `transform`
   (`translateX`, `translateY`, `scale`) and `opacity` only — they run on the
   GPU compositor without touching the main thread.
4. **Never use `transition-all`.** It transitions every CSS property that
   changes, including expensive ones like `padding` or `border`. Always specify
   exact properties: `transition-[color,background-color,opacity,transform]`.
5. **Never use `document.body.style.overflow = "hidden"` on iOS.** It forces a
   full layout reflow. Use the `position: fixed` + `top: -scrollY` pattern
   instead, restoring scroll position on close.
6. **Minimize `requestAnimationFrame` chains.** Double-RAF (RAF inside RAF) adds
   16ms+ of dead time on a saturated main thread. Use single RAF unless you
   provably need two layout passes.
7. **Lazy-load below-the-fold sections.** Use `IntersectionObserver` with
   `rootMargin: "200px"` to mount heavy components (maps, carousels) only when
   they approach the viewport.
8. **Scope heavy CSS imports.** Don't import `maplibre-gl.css` (or any large
   third-party stylesheet) in the root layout — import it in the component that
   uses it, behind lazy loading.

---

## Root Causes Found (May 2026)

### 1. Duplicate StickySearchBar (CRITICAL)

**What:** `HomePageClient.tsx` rendered `<StickySearchBar hero />` inside
`HeroSection` AND `<StickySearchBar visible={showSticky} />` at the root level
after first scroll. Each instance carried ~20 `useState`, multiple `useEffect`,
`createPortal` dimmers, document-level `pointerdown` listeners, calendar state,
etc.

**Impact:** Every interaction (typing, opening a panel, switching sections)
re-rendered ~40 hooks instead of ~20. On a mobile CPU, this added 30-80ms of
main-thread blocking per interaction.

**Fix:** Single `StickySearchBar` instance with `hero={!showSticky}` prop that
switches presentation between inline (hero mode) and fixed (sticky mode).
Passed as `searchBar` render prop to `HeroSection`.

### 2. Hero `blur-[90px]` (HIGH)

**What:** A 500×800px div with `filter: blur(90px)` above the fold.

**Impact:** CSS blur is one of the most expensive GPU operations on mobile. This
ran continuously, degrading baseline FPS and competing with touch interactions.

**Fix:** Replaced with `bg-[radial-gradient(ellipse_at_center,...)]` — same
visual effect, zero GPU cost.

### 3. `left`/`width` Animations (HIGH)

**What:** The sliding pill in the search bar animated `left` and `width` CSS
properties. The floating card animated `width`.

**Impact:** Animating layout properties triggers browser layout recalculation
on every animation frame (~60× per second). On mobile, each recalc can take
5-15ms, causing dropped frames.

**Fix:**
- Pill: `left` → `transform: translateX()` with `will-change-transform`
- Card: animated `width` → static `max-width`

### 4. SiteHeader Double-RAF + `overflow: hidden` (HIGH)

**What:** Opening the hamburger menu used two nested `requestAnimationFrame`
callbacks before starting the slide animation, plus set
`document.body.style.overflow = "hidden"`.

**Impact:** Double-RAF = minimum 32ms delay before the panel visually starts
moving. `overflow: hidden` on body triggers iOS Safari to recalculate the
viewport layout.

**Fix:**
- Single RAF for the animation trigger
- `position: fixed` + `top: -scrollY` pattern for body scroll lock
- Reduced animation duration from 400ms to 300ms

### 5. Portal Dimmer Always Mounted (MEDIUM)

**What:** The full-screen dimmer overlay behind the search panel was always
mounted in a portal, transitioning `background-color` from transparent to
`rgba(...)`.

**Impact:** Even when invisible, the browser tracked a full-viewport composited
layer. The `background-color` transition on a full-screen element is expensive.

**Fix:** Only mount the portal when `activeSection` is non-null. No transition
on the dimmer — it appears/disappears instantly.

### 6. `backdrop-blur` on Various Elements (MEDIUM)

**What:** `backdrop-blur-sm` on SitterCard badge, `backdrop-blur-md` on scrolled
header, `backdrop-blur-xl` on CookieBanner and DogShiftBot, `backdrop-blur` on
MapPreview buttons.

**Fix:** Replaced all with solid `bg-white` backgrounds.

### 7. Service Worker Overhead (LOW-MEDIUM)

**What:** The SW intercepted all GET requests including `/api/` and `/_next/data/`
routes, adding overhead to every fetch.

**Fix:** Skip `/api/` and `/_next/data/` in the SW `fetch` handler. Only cache
`navigate` requests (full page loads).

---

## How to Test Performance

1. **Chrome DevTools → Performance tab**: Record a trace while opening/closing
   the hamburger menu. Look for long tasks (>50ms) in the flame chart.
2. **Rendering tab → Paint flashing**: Green flashes show repaints. Opening
   the menu should only flash the panel, not the entire page.
3. **Rendering tab → Layout shift regions**: Blue flashes show layout shifts.
   None should appear during menu/search interactions.
4. **Lighthouse → Performance (Mobile)**: Target 90+ on mobile. Watch TBT
   (Total Blocking Time) and CLS (Cumulative Layout Shift).
5. **Real device testing**: Use Safari on a mid-range iPhone. Performance issues
   that are invisible on desktop Chrome are very noticeable on mobile Safari.

---

## Files to Watch

| File | Risk | Why |
|------|------|-----|
| `app/(marketing)/HomePageClient.tsx` | HIGH | 3000+ lines, ~20 hooks in StickySearchBar |
| `components/SiteHeader.tsx` | HIGH | Hamburger menu animation, body scroll lock |
| `components/DogShiftBot.tsx` | MEDIUM | Always mounted, touch event handlers |
| `components/CookieBanner.tsx` | LOW | Full-screen overlay when visible |
| `components/LeadMagnetBanner.tsx` | MEDIUM | Full-screen overlay after 3.5s timeout |
| `components/MapPreview.tsx` | MEDIUM | MapLibre GL JS initialization |
| `public/sw.js` | LOW | Service Worker fetch handler scope |
| `app/globals.css` | LOW | CSS animations, universal selectors |

---

## Checklist Before Merging Homepage Changes

- [ ] No `backdrop-blur` on any element visible on mobile homepage
- [ ] No `transition-all` — use specific property lists
- [ ] No animation of `left`, `top`, `width`, `height` — use `transform`
- [ ] No duplicate instances of stateful components
- [ ] No `document.body.style.overflow = "hidden"` — use position:fixed pattern
- [ ] Heavy libraries (maplibre-gl, etc.) loaded lazily, not in root layout
- [ ] Below-the-fold sections wrapped in `LazySection`
- [ ] Test on real mobile device (not just Chrome DevTools emulation)
