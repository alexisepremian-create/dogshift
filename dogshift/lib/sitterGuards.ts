import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { isActivatedStatus, isContractSignedStatus, type SitterLifecycleStatus } from "@/lib/sitterContract";

export type SitterGateState =
  | { ok: true }
  | { ok: false; status: 403; error: "TERMS_NOT_ACCEPTED" }
  | { ok: false; status: 403; error: "PROFILE_INCOMPLETE"; profileCompletion: number }
  | { ok: false; status: 403; error: "CONTRACT_NOT_SIGNED" }
  | { ok: false; status: 403; error: "ACCOUNT_NOT_ACTIVATED" };

export function checkSitterSensitiveActionGate(args: {
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  profileCompletion: number;
  lifecycleStatus: SitterLifecycleStatus;
}): SitterGateState {
  const termsOk = Boolean(args.termsAcceptedAt) && args.termsVersion === CURRENT_TERMS_VERSION;
  if (!termsOk) {
    return { ok: false, status: 403, error: "TERMS_NOT_ACCEPTED" };
  }

  if (args.profileCompletion < 100) {
    return { ok: false, status: 403, error: "PROFILE_INCOMPLETE", profileCompletion: args.profileCompletion };
  }

  if (!isContractSignedStatus(args.lifecycleStatus)) {
    return { ok: false, status: 403, error: "CONTRACT_NOT_SIGNED" };
  }

  if (!isActivatedStatus(args.lifecycleStatus)) {
    return { ok: false, status: 403, error: "ACCOUNT_NOT_ACTIVATED" };
  }

  return { ok: true };
}
