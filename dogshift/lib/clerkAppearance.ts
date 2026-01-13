import type { Theme } from "@clerk/types";

export const clerkAppearance: Theme = {
  layout: {
    logoPlacement: "inside",
    logoImageUrl: "/dogshift-logo.png",
  },
  variables: {
    colorPrimary: "var(--dogshift-blue)",
    colorText: "#0F172A",
    colorTextSecondary: "#475569",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0F172A",
    borderRadius: "14px",
    fontFamily: "var(--font-geist-sans)",
  },
  elements: {
    card: "rounded-[16px] border border-slate-200/70 bg-white shadow-[0_18px_70px_-40px_rgba(15,23,42,0.55)]",
    headerTitle: "text-[22px] font-semibold tracking-[-0.02em] text-slate-900",
    headerSubtitle: "text-sm text-slate-600",
    socialButtonsBlockButton:
      "rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50",
    dividerLine: "bg-slate-200",
    dividerText: "text-slate-500",
    formFieldLabel: "text-sm font-medium text-slate-700",
    formFieldInput:
      "h-11 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm outline-none ring-0 focus:border-slate-300 focus:ring-2 focus:ring-[rgba(11,77,140,0.25)]",
    formButtonPrimary:
      "h-11 rounded-xl bg-[var(--dogshift-blue)] text-white shadow-sm hover:bg-[var(--dogshift-blue-hover)]",
    footer: "hidden",
    footerPages: "hidden",
    footerPageLink: "hidden",
    poweredByClerk: "hidden",
    badge: "hidden",
    identityPreview: "rounded-xl border border-slate-200 bg-slate-50",
  },
};
