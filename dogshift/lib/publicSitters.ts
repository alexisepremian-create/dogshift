export function publicSittersIndexKey() {
  return "ds_public_sitters_index";
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function loadPublicSittersIndex(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(publicSittersIndexKey());
  if (!raw) return [];
  const parsed = safeParseJson(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export function savePublicSittersIndex(ids: string[]) {
  if (typeof window === "undefined") return;
  const unique = Array.from(new Set(ids.map((x) => x.trim()).filter(Boolean)));
  window.localStorage.setItem(publicSittersIndexKey(), JSON.stringify(unique));
}

export function addToPublicSittersIndex(sitterId: string) {
  const current = loadPublicSittersIndex();
  if (current.includes(sitterId)) return current;
  const next = [...current, sitterId];
  savePublicSittersIndex(next);
  return next;
}
