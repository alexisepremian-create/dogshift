"use client";

import { createContext, useContext } from "react";

/**
 * Signals that the subtree is rendered INSIDE a native DashboardSheet (a tile
 * popup), as opposed to a full page reached via the bottom nav.
 *
 * Panels self-fetch their data and normally show a grey skeleton while loading.
 * The founder wants the sheet popups to load with ONLY a spinner (no skeleton) —
 * while the route-level (bottom nav) skeletons stay as-is. Pages read this flag
 * to swap their loading skeleton for a spinner when they're in a sheet.
 */
export const InDashboardSheetContext = createContext(false);

export function useInDashboardSheet(): boolean {
  return useContext(InDashboardSheetContext);
}

/** Centered purple spinner used for sheet-panel loading states. */
export function PanelSpinner() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
    </div>
  );
}
