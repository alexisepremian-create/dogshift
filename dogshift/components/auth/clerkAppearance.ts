/**
 * DogShift visual theme for Clerk's prebuilt <SignIn /> and <SignUp /> components.
 *
 * The `elements` map below mirrors the Tailwind classes our previous custom
 * forms used. By using Clerk's prebuilt components + this theme we get:
 *   - automatic CAPTCHA / OTP / OAuth handling (no more 401 / "already
 *     verified" / form-submission-cancelled bugs)
 *   - automatic security and API updates from Clerk
 *   - 100% compatibility with @clerk/nextjs upgrades
 *
 * Anatomy reference:
 *   https://clerk.com/docs/customization/overview#appearance-prop
 */

/* Tailwind class strings reused across forms. */
const PRIMARY_BUTTON =
  "rounded-full bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-sm py-3 px-5 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 normal-case tracking-normal";

const SECONDARY_BUTTON =
  "rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-sm py-3 px-5 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 normal-case tracking-normal";

const INPUT =
  "rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60";

const OTP_DIGIT =
  "h-14 w-11 select-none rounded-2xl border border-slate-300 bg-white text-center text-xl font-semibold text-slate-900 shadow-sm transition focus:border-slate-800 focus:ring-4 focus:ring-slate-200 outline-none";

export const dogshiftClerkAppearance = {
  layout: {
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    showOptionalFields: false,
  },
  variables: {
    colorPrimary: "#0f172a",
    colorText: "#0f172a",
    colorTextSecondary: "#64748b",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#0f172a",
    colorDanger: "#e11d48",
    colorSuccess: "#16a34a",
    fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
    borderRadius: "1rem",
    spacingUnit: "1rem",
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-none border-0 bg-transparent p-0",

    header: "mb-2",
    headerTitle: "text-center text-2xl font-semibold tracking-tight text-slate-900",
    headerSubtitle: "text-center text-sm text-slate-600",

    socialButtonsBlockButton: SECONDARY_BUTTON + " w-full",
    socialButtonsBlockButtonText: "text-sm font-semibold text-slate-900",
    socialButtonsProviderIcon: "h-5 w-5",

    dividerRow: "my-4",
    dividerLine: "bg-slate-200 h-px",
    dividerText: "text-xs font-medium text-slate-500",

    formFieldRow: "space-y-2",
    formFieldLabel: "block text-sm font-medium text-slate-700",
    formFieldInput: INPUT,
    formFieldInputShowPasswordButton: "text-slate-500 hover:text-slate-700",
    formFieldErrorText: "mt-1 text-sm text-rose-600",
    formFieldHintText: "mt-1 text-xs text-slate-500",
    formFieldSuccessText: "mt-1 text-sm text-emerald-600",
    formFieldAction: "text-sm font-medium text-slate-600 hover:text-slate-900",

    formButtonPrimary: PRIMARY_BUTTON + " w-full",
    formButtonReset: SECONDARY_BUTTON,

    formResendCodeLink:
      "text-sm font-medium text-slate-600 hover:text-slate-900 transition disabled:cursor-not-allowed disabled:opacity-50",

    otpCodeFieldInput: OTP_DIGIT,
    otpCodeFieldInputs: "flex items-center justify-center gap-2.5",
    otpCodeFieldErrorText: "mt-2 text-center text-sm text-rose-600",

    identityPreview: "rounded-2xl border border-slate-200 bg-white p-3",
    identityPreviewText: "text-sm font-medium text-slate-900",
    identityPreviewEditButton: "text-sm font-medium text-slate-600 hover:text-slate-900",

    alert: "rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700",
    alertText: "text-sm text-rose-700",

    footer: "mt-6",
    footerActionText: "text-sm text-slate-600",
    footerActionLink: "font-semibold text-slate-900 hover:underline underline-offset-2",
    footerPagesLink: "text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2",
  },
};
