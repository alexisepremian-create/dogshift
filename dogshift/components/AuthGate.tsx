"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getAuthRole, getAuthUser, type DogShiftAuthRole } from "@/lib/auth";

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

  if (!hydrated) return null;
  if (requireAuth && !authed) return null;
  if (requireAuth && authed && !roleAllowed) return null;

  return <>{children}</>;
}
