/**
 * Translates Clerk errors into user-friendly French messages.
 *
 * Clerk throws ClerkAPIResponseError with an `errors: ClerkAPIError[]` array.
 * Each error has `{ code, message, longMessage }` — we prefer our own French
 * mapping for known codes, then fall back to `longMessage` (already localised
 * via @clerk/localizations frFR), and finally a generic French fallback.
 *
 * Also detects a few common non-Clerk runtime errors (network offline, etc.)
 * so auth forms never show raw English strings.
 */

type UnknownError = unknown;

interface ClerkErrorShape {
  code?: string;
  message?: string;
  longMessage?: string;
}

interface ClerkResponseErrorShape {
  clerkError?: true;
  errors?: ClerkErrorShape[];
  message?: string;
}

/**
 * Map of Clerk error codes → French message.
 * Covers the codes that can realistically reach a DogShift user.
 * Codes not in this map fall back to Clerk's own French message (via frFR localization).
 */
const CLERK_CODE_TO_FR: Record<string, string> = {
  // Email code verification
  form_code_incorrect:
    "Code incorrect. Vérifie que tu saisis bien le dernier code reçu par e-mail — les anciens codes ne sont plus valides.",
  verification_expired:
    "Ce code a expiré (il est valable environ 10 minutes). Demande un nouveau code puis réessaie.",
  verification_failed:
    "La vérification a échoué. Demande un nouveau code puis réessaie.",
  verification_already_verified:
    "Ce code a déjà été utilisé. Demande un nouveau code puis réessaie.",
  verification_unknown:
    "Impossible de vérifier le code. Réessaie dans un instant.",

  // Password
  form_password_incorrect: "Mot de passe incorrect.",
  form_password_pwned:
    "Ce mot de passe a été compromis dans une fuite de données. Choisis-en un autre.",
  form_password_length_too_short:
    "Le mot de passe est trop court.",
  form_password_not_strong_enough:
    "Mot de passe trop faible. Utilise au moins 8 caractères avec des chiffres et des majuscules.",

  // Identifier / email
  form_identifier_not_found:
    "Aucun compte ne correspond à cette adresse e-mail. Vérifie l'orthographe ou crée un compte.",
  form_identifier_exists:
    "Un compte existe déjà avec cette adresse e-mail. Connecte-toi plutôt.",
  form_param_format_invalid:
    "Le format saisi n'est pas valide.",
  form_param_nil: "Champ obligatoire manquant.",

  // Rate limiting
  too_many_requests:
    "Trop de tentatives. Patiente quelques minutes avant de réessayer.",
  user_locked:
    "Ton compte est temporairement verrouillé suite à trop de tentatives. Réessaie dans quelques minutes.",

  // Session / client
  session_exists:
    "Tu es déjà connecté. Rafraîchis la page ou déconnecte-toi avant de continuer.",
  client_state_invalid:
    "Ta session a expiré ou n'est plus valide. Recommence la connexion.",
  signin_identifier_required:
    "Merci d'entrer ton adresse e-mail.",

  // OAuth / Google
  oauth_access_denied:
    "L'authentification Google a été annulée.",
  oauth_callback_error:
    "La connexion Google a échoué. Réessaie ou utilise ton adresse e-mail.",
  oauth_email_domain_reserved:
    "Cette adresse e-mail n'est pas autorisée pour la connexion Google.",
};

function isClerkErrorShape(value: unknown): value is ClerkErrorShape {
  return !!value && typeof value === "object" && "code" in (value as object);
}

function extractClerkErrorsArray(err: UnknownError): ClerkErrorShape[] {
  if (!err || typeof err !== "object") return [];
  const anyErr = err as ClerkResponseErrorShape & { errors?: unknown };
  if (Array.isArray(anyErr.errors)) {
    return anyErr.errors.filter(isClerkErrorShape);
  }
  // Some throws flatten a single ClerkAPIError directly.
  if (isClerkErrorShape(err)) {
    return [err];
  }
  return [];
}

/**
 * Returns a user-facing French message for any auth error.
 * Never returns an empty string; always has a fallback.
 */
export function clerkErrorMessage(
  err: UnknownError,
  fallback = "Une erreur est survenue. Réessaie dans un instant.",
): string {
  if (!err) return fallback;

  // Network failures (fetch rejected) — these never hit Clerk.
  if (err instanceof TypeError && /fetch|network/i.test(err.message ?? "")) {
    return "Problème de connexion réseau. Vérifie ta connexion puis réessaie.";
  }

  const clerkErrors = extractClerkErrorsArray(err);
  if (clerkErrors.length > 0) {
    const first = clerkErrors[0];
    if (first.code && CLERK_CODE_TO_FR[first.code]) {
      return CLERK_CODE_TO_FR[first.code];
    }
    // Clerk localisation frFR populates longMessage in French for most codes.
    if (first.longMessage && first.longMessage.trim().length > 0) {
      return first.longMessage;
    }
    if (first.message && first.message.trim().length > 0) {
      return first.message;
    }
  }

  // Plain Error or anything else with a .message
  if (err instanceof Error && err.message) {
    // Heuristic: if the message looks like a raw English code (ALL_CAPS_WITH_UNDERSCORES),
    // prefer the generic French fallback rather than leaking it to the user.
    if (/^[A-Z][A-Z0-9_]+$/.test(err.message.trim())) {
      return fallback;
    }
    return err.message;
  }

  return fallback;
}

/**
 * Extracts the Clerk error code from a thrown error, if any.
 * Used to tag Sentry events so we can alert on specific failure modes.
 */
export function clerkErrorCode(err: UnknownError): string | undefined {
  const errors = extractClerkErrorsArray(err);
  return errors[0]?.code;
}

/**
 * Cleans a 6-digit verification code copy-pasted by the user:
 * strips every non-numeric character (invisible whitespace from Outlook/Gmail,
 * zero-width spaces, dashes if Clerk ever formats them, etc.).
 *
 * This prevents the #1 cause of "code invalide" reports: paste with hidden
 * characters that Clerk rejects but the user sees as a valid-looking code.
 */
export function sanitizeVerificationCode(input: string): string {
  return (input ?? "").replace(/[^0-9]/g, "");
}
