"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { DEFAULT_MAINTENANCE_PUBLIC_MESSAGE } from "@/lib/platform/maintenanceConstants";

type StatusPayload = {
  ok?: boolean;
  maintenanceMode?: boolean;
  message?: string | null;
};

type MaintenanceContextValue = {
  maintenanceMode: boolean;
  bannerMessage: string | null;
  refresh: () => Promise<void>;
  loading: boolean;
};

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null);

export function useMaintenance(): MaintenanceContextValue {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) {
    return {
      maintenanceMode: false,
      bannerMessage: null,
      refresh: async () => {},
      loading: false,
    };
  }
  return ctx;
}

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/status", { cache: "no-store" });
      const data = (await res.json()) as StatusPayload;
      const active = Boolean(data?.maintenanceMode);
      setMaintenanceMode(active);
      if (active) {
        const msg =
          typeof data?.message === "string" && data.message.trim() ? data.message.trim() : DEFAULT_MAINTENANCE_PUBLIC_MESSAGE;
        setBannerMessage(msg);
      } else {
        setBannerMessage(null);
      }
    } catch {
      setMaintenanceMode(false);
      setBannerMessage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ maintenanceMode, bannerMessage, refresh, loading }),
    [maintenanceMode, bannerMessage, refresh, loading]
  );

  return (
    <MaintenanceContext.Provider value={value}>
      {maintenanceMode && bannerMessage ? (
        <div
          role="status"
          className="sticky top-0 z-[100] border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-950 shadow-sm"
        >
          {bannerMessage}
        </div>
      ) : null}
      {children}
    </MaintenanceContext.Provider>
  );
}
