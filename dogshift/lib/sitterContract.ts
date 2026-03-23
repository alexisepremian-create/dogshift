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
  "1. Le dogsitter confirme intervenir via DogShift dans un cadre professionnel, sérieux et conforme aux engagements de la plateforme.",
  "2. Le dogsitter s’engage à fournir des informations exactes, à maintenir son profil à jour et à exécuter les prestations avec diligence.",
  "3. Le dogsitter respecte les consignes transmises par les owners, la sécurité des animaux et les règles applicables en Suisse.",
  "4. Le dogsitter accepte que DogShift puisse suspendre ou retirer l’accès au service en cas de non-respect des engagements, de comportement inadéquat ou de manquement opérationnel.",
  "5. Tant que le compte n’est pas activé par DogShift au moyen d’un code d’activation valide, aucune activation définitive n’est acquise.",
  "6. La signature électronique par nom saisi et confirmation expresse vaut engagement contractuel, horodaté et conservé par DogShift.",
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
