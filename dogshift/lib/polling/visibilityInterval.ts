// Visibility-aware polling primitive.
//
// A plain `setInterval` keeps firing even when the browser tab is in the
// background. For polls that hit the DB (notifications, admin agent health,
// maintenance logs), a backgrounded tab left open would keep Neon's compute
// awake 24/7 and rack up CU-hours. This primitive pauses the interval while
// the document is hidden and resumes it when the tab becomes visible again.
//
// The React wrapper lives in `useVisibleInterval.ts`. This file is
// framework-free so the timing logic can be unit-tested without a DOM renderer.

export interface VisibilityDocument {
  hidden: boolean;
  addEventListener: (type: "visibilitychange", handler: () => void) => void;
  removeEventListener: (type: "visibilitychange", handler: () => void) => void;
}

export interface VisibilityIntervalOptions {
  /**
   * When the tab returns to the foreground, run the callback once immediately
   * (so the UI refreshes right away) before resuming the interval. Default: true.
   */
  fireOnVisible?: boolean;
}

/**
 * Start a `setInterval` that only ticks while `doc` is visible.
 * Returns a cleanup function that removes the listener and clears the interval.
 */
export function createVisibilityInterval(
  doc: VisibilityDocument,
  callback: () => void,
  delayMs: number,
  options: VisibilityIntervalOptions = {}
): () => void {
  const fireOnVisible = options.fireOnVisible ?? true;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  const start = () => {
    if (intervalId == null) {
      intervalId = setInterval(callback, delayMs);
    }
  };

  const stop = () => {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  };

  const onVisibilityChange = () => {
    if (doc.hidden) {
      stop();
    } else {
      if (fireOnVisible) callback();
      start();
    }
  };

  if (!doc.hidden) start();
  doc.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    stop();
  };
}
