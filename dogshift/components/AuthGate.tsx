"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { getAuthRole, getAuthUser, type DogShiftAuthRole } from "@/lib/auth";
import PageLoader, { PAGE_LOADER_MIN_DURATION_MS } from "@/components/ui/PageLoader";

type AuthGateProps = {
  children: React.ReactNode;
  requireAuth?: boolean;
  allowedRoles?: DogShiftAuthRole[];
};

function defaultRouteForRole(role: DogShiftAuthRole) {
  return role === "owner" ? "/account" : "/host";
}

export default function AuthGate({ children, requireAuth = false, allowedRoles }: AuthGateProps) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState<DogShiftAuthRole | null>(null);
  const [authed, setAuthed] = useState(false);
  const mountRef = useRef(Date.now());
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const elapsed = Date.now() - mountRef.current;
    const remaining = Math.max(0, PAGE_LOADER_MIN_DURATION_MS - elapsed);
    if (remaining === 0) {
      setMinElapsed(true);
      return;
    }
    const t = setTimeout(() => setMinElapsed(true), remaining);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setHydrated(true);

    const refresh = () => {
      const u = getAuthUser();
      setAuthed(Boolean(u));
      setRole(getAuthRole());
    };

    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ds_auth_user") refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const roleAllowed = useMemo(() => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    if (!role) return false;
    return allowedRoles.includes(role);
  }, [allowedRoles, role]);

  useEffect(() => {
    if (!hydrated) return;

    if (requireAuth && !authed) {
      router.replace("/login");
      return;
    }

    if (requireAuth && authed && !roleAllowed) {
      const next = defaultRouteForRole(role ?? "sitter");
      router.replace(next);
    }
  }, [hydrated, requireAuth, authed, roleAllowed, role, router]);

  if (!hydrated) return <PageLoader label="Chargement…" />;
  if (requireAuth && !authed) return <PageLoader label="Connexion en cours…" />;
  if (requireAuth && authed && !roleAllowed) return <PageLoader label="Chargement…" />;
  if (!minElapsed) return <PageLoader label="Chargement…" />;

  return <>{children}</>;
}
