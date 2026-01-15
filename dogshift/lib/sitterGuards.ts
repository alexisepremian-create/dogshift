import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export type SitterGateState =
  | { ok: true }
  | { ok: false; status: 403; error: "TERMS_NOT_ACCEPTED" }
  | { ok: false; status: 403; error: "PROFILE_INCOMPLETE"; profileCompletion: number };

export function checkSitterSensitiveActionGate(args: {
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  profileCompletion: number;
}): SitterGateState {
  const termsOk = Boolean(args.termsAcceptedAt) && args.termsVersion === CURRENT_TERMS_VERSION;
  if (!termsOk) {
    return { ok: false, status: 403, error: "TERMS_NOT_ACCEPTED" };
  }

  if (args.profileCompletion < 100) {
    return { ok: false, status: 403, error: "PROFILE_INCOMPLETE", profileCompletion: args.profileCompletion };
  }

  return { ok: true };
}
