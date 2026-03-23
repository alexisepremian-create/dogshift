import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const CURRENT_SITTER_CONTRACT_VERSION = "2026-03-23";

export type SitterLifecycleStatus =
  | "application_received"
  | "selected"
  | "contract_to_sign"
  | "contract_signed"
  | "activated";

export const SITTER_CONTRACT_TITLE = "Contrat d’engagement Dogsitter DogShift";

export const SITTER_CONTRACT_CONTENT = [
  "Ce document constitue un engagement contractuel entre le dogsitter et DogShift. Il doit être signé avant toute activation de compte. En signant, le dogsitter reconnaît avoir compris et accepté l’ensemble des conditions ci-dessous.",
  "1. Statut et rôle\nLe dogsitter agit en tant qu’indépendant. DogShift agit uniquement comme plateforme de mise en relation et ne fournit aucune prestation de garde. Le dogsitter est seul responsable des services rendus.",
  "2. Responsabilité\nLe dogsitter assume l’entière responsabilité des dommages matériels, corporels ou immatériels causés durant les prestations. DogShift ne peut être tenu responsable des actes du dogsitter ou du propriétaire.",
  "3. Assurance responsabilité civile\nLe dogsitter s’engage à disposer d’une assurance responsabilité civile couvrant explicitement la garde d’animaux, y compris dans un cadre rémunéré. Une preuve peut être demandée à tout moment.",
  "4. Casier judiciaire\nLe dogsitter certifie disposer d’un casier judiciaire vierge et s’engage à informer immédiatement DogShift de tout changement. DogShift se réserve le droit de demander un extrait officiel.",
  "5. Expérience et compétences\nLe dogsitter déclare avoir l’expérience nécessaire pour gérer des chiens de différentes tailles et comportements, et s’engage à assurer leur sécurité en toute circonstance.",
  "6. Fiabilité et comportement\nLe dogsitter s’engage à être ponctuel, fiable, respectueux, et à maintenir un comportement professionnel avec les propriétaires.",
  "7. Communication et incidents\nLe dogsitter doit informer immédiatement le propriétaire en cas de problème et tenir DogShift informé en cas d’incident grave.",
  "8. Contribution à la plateforme\nLe dogsitter s’engage à signaler tout bug, erreur ou dysfonctionnement rencontré afin d’améliorer la plateforme.",
  "9. Engagement de fidélité (phase pilote)\nDans le cadre de la phase pilote (0% de commission), le dogsitter s’engage à ne pas contourner la plateforme pour les mises en relation initiées via DogShift.",
  "10. Positionnement DogShift\nLe dogsitter comprend que DogShift est une plateforme premium et s’engage à maintenir un niveau de qualité élevé.",
  "11. Résiliation\nDogShift se réserve le droit de suspendre ou supprimer un compte en cas de non-respect des présentes conditions.",
].join("\n\n");

export function normalizeSitterLifecycleStatus(raw: unknown, published?: boolean | null): SitterLifecycleStatus {
  if (
    raw === "application_received" ||
    raw === "selected" ||
    raw === "contract_to_sign" ||
    raw === "contract_signed" ||
    raw === "activated"
  ) {
    return raw;
  }

  if (published) {
    return "activated";
  }

  return "application_received";
}

export function canAccessContractPage(status: SitterLifecycleStatus) {
  return status === "selected" || status === "contract_to_sign" || status === "contract_signed" || status === "activated";
}

export function canGenerateContractAccessLink(status: SitterLifecycleStatus) {
  return status === "selected" || status === "contract_to_sign";
}

export function isContractSignedStatus(status: SitterLifecycleStatus) {
  return status === "contract_signed" || status === "activated";
}

export function isActivatedStatus(status: SitterLifecycleStatus) {
  return status === "activated";
}

export function normalizeActivationCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashActivationCode(raw: string) {
  return createHash("sha256").update(normalizeActivationCode(raw)).digest("hex");
}

export function generateContractAccessToken() {
  return randomBytes(32).toString("hex");
}

export function hashContractAccessToken(rawToken: string, secret: string) {
  return createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

export function contractAccessTokenFingerprint(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex").slice(0, 12);
}

export function contractAccessTokenMatches(expectedHash: string | null | undefined, rawToken: string, secret: string) {
  if (!expectedHash || !rawToken || !secret) return false;
  const candidateHash = hashContractAccessToken(rawToken, secret);
  const a = Buffer.from(expectedHash);
  const b = Buffer.from(candidateHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function contractAccessTokenTtlMs() {
  const raw = (process.env.SITTER_CONTRACT_LINK_TTL_HOURS || "").trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
  return hours * 60 * 60 * 1000;
}

export function buildContractAccessUrl(baseUrl: string, rawToken: string) {
  return `${baseUrl.replace(/\/$/, "")}/contract/sign/${encodeURIComponent(rawToken)}`;
}

export function isContractAccessLinkExpired(expiresAt: Date | string | null | undefined, now = Date.now()) {
  if (!expiresAt) return true;
  const ts = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return !Number.isFinite(ts) || ts <= now;
}

export function contractSigningAllowed(status: SitterLifecycleStatus) {
  return status === "selected" || status === "contract_to_sign";
}

export function buildSignedContractSnapshot(args: {
  sitterId: string;
  userId: string;
  signerName: string;
  signedAt: string;
}) {
  return {
    title: SITTER_CONTRACT_TITLE,
    version: CURRENT_SITTER_CONTRACT_VERSION,
    content: SITTER_CONTRACT_CONTENT,
    signerName: args.signerName,
    signedAt: args.signedAt,
    userId: args.userId,
    sitterId: args.sitterId,
    signatureMode: "typed_name_confirmation",
  };
}

export function lifecycleStatusLabel(status: SitterLifecycleStatus) {
  if (status === "application_received") return "candidature reçue";
  if (status === "selected") return "sélectionné";
  if (status === "contract_to_sign") return "contrat à signer";
  if (status === "contract_signed") return "contrat signé";
  return "activé";
}
