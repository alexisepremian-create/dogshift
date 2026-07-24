"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Heart, HelpCircle, ScrollText, Shield, Lock, Mail, LogOut, Info } from "lucide-react";
import { createElement } from "react";

import type { BottomNavItem } from "@/components/MobileBottomNav";

/**
 * The "more menu" that used to open from the center bottom-nav FAB — now hosted
 * on the homepage search bar (the FAB opens the breeding feature instead). Kept
 * as a shared builder so there's a single source of truth for the items.
 */
export function buildNativeMenuItems(opts: { role: string | null; isSitter: boolean; pathname: string }): BottomNavItem[] {
  const { role, isSitter, pathname } = opts;
  const icon = (C: typeof Mail) => createElement(C, { className: "h-5 w-5" });

  const commonFull: BottomNavItem[] = [
    { key: "devenir-sitter", label: "Devenir dogsitter", href: "/devenir-dogsitter", icon: icon(HelpCircle), active: pathname === "/devenir-dogsitter" },
    { key: "contact", label: "Contact", href: "/contact", icon: icon(Mail), active: pathname === "/contact" },
    { key: "cgu", label: "Conditions d'utilisation", href: "/cgu", icon: icon(ScrollText), active: pathname === "/cgu" },
    { key: "confidentialite", label: "Confidentialité", href: "/confidentialite", icon: icon(Lock), active: pathname === "/confidentialite" },
    { key: "mentions", label: "Mentions légales", href: "/mentions-legales", icon: icon(Info), active: pathname === "/mentions-legales" },
  ];

  const items: BottomNavItem[] = [];
  if (isSitter) {
    items.push({ key: "account", label: "Mon compte (owner)", href: "/account", icon: icon(Heart), active: pathname === "/account" });
  }
  if (role === "ADMIN") {
    items.push({ key: "admin", label: "Admin", href: "/admin/dashboard", icon: icon(Shield), active: pathname.startsWith("/admin") });
  }
  // Sitters keep the full common list (incl. "Devenir dogsitter"); owners already
  // lead with it, so drop the duplicate.
  items.push(...(isSitter ? commonFull : commonFull.filter((c) => c.key !== "devenir-sitter")));
  if (!isSitter) items.unshift(commonFull[0]);
  items.push({ key: "logout", label: "Déconnexion", href: "/sign-out", icon: icon(LogOut), active: false });
  return items;
}

export function useNativeMenuItems(): BottomNavItem[] {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  const [isSitter] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("ds_is_sitter") === "1";
    } catch {
      return false;
    }
  });
  return buildNativeMenuItems({ role, isSitter, pathname });
}
