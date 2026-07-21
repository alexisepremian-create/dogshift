"use client";

import { useEffect, useRef } from "react";

import { createVisibilityInterval } from "./visibilityInterval";

interface UseVisibleIntervalOptions {
  /** Skip polling entirely while false (e.g. a tab/panel is closed). Default: true. */
  enabled?: boolean;
  /** Fire once immediately when the tab regains focus. Default: true. */
  fireOnVisible?: boolean;
}

/**
 * `setInterval` that automatically pauses when the tab is hidden and resumes
 * when it becomes visible again. Prevents background tabs from waking Neon.
 *
 * The callback is stored in a ref so its changing identity does not re-subscribe
 * the interval — only `delayMs`, `enabled` and `fireOnVisible` do.
 */
export function useVisibleInterval(
  callback: () => void,
  delayMs: number,
  options: UseVisibleIntervalOptions = {}
): void {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const enabled = options.enabled ?? true;
  const fireOnVisible = options.fireOnVisible ?? true;

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    return createVisibilityInterval(
      document,
      () => savedCallback.current(),
      delayMs,
      { fireOnVisible }
    );
  }, [enabled, delayMs, fireOnVisible]);
}
