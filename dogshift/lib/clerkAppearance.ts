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
    colorBackground: "transparent",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0F172A",
    borderRadius: "14px",
    fontFamily: "var(--font-geist-sans)",
  },
  elements: {
    rootBox: "w-full bg-transparent",
    main: "w-full bg-transparent",
    card: "w-full border-0 bg-transparent p-0 shadow-none rounded-none",
    cardBox: "w-full shadow-none border-0 bg-transparent p-0 rounded-none",
    pageScrollBox: "bg-transparent",
    navbar: "hidden",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    logoBox: "hidden",
    socialButtons: "grid grid-cols-1 gap-3 sm:grid-cols-2",
    socialButtonsBlockButton:
      "h-11 w-full rounded-full border border-slate-200/80 bg-white/80 text-slate-900 backdrop-blur-sm shadow-none transition hover:bg-white active:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_82%)]",
    dividerLine: "bg-slate-200/80",
    dividerText: "text-slate-500",
    formFieldLabel: "text-sm font-medium text-slate-700",
    formFieldInput:
      "h-11 w-full rounded-full border border-slate-200/80 bg-white/80 px-4 text-slate-900 shadow-none outline-none transition focus:border-[color-mix(in_srgb,var(--dogshift-blue),black_10%)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_82%)]",
    formButtonPrimary:
      "h-11 w-full rounded-full bg-[var(--dogshift-blue)] text-white shadow-none transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)]",
    form: "space-y-4",
    footer: "hidden",
    footerPages: "hidden",
    footerPageLink: "hidden",
    poweredByClerk: "hidden",
    badge: "hidden",
    identityPreview: "rounded-xl border border-slate-200 bg-slate-50",
  },
};
