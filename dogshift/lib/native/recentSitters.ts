// Recently-viewed sitters, persisted client-side (localStorage). Written when a
// sitter fiche is opened on the native map home, read by the Messages "+"
// new-conversation picker so it doubles as a shortcut to profiles you just
// looked at (founder request). Best-effort — never throws.

export type RecentSitter = { id: string; name: string; avatarUrl: string | null };

const KEY = "ds_recent_sitters";
const MAX = 10;

export function pushRecentSitter(sitter: RecentSitter): void {
  if (typeof window === "undefined") return;
  const id = String(sitter?.id ?? "").trim();
  if (!id) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: RecentSitter[] = raw ? (JSON.parse(raw) as RecentSitter[]) : [];
    const clean = Array.isArray(list) ? list.filter((x) => x && typeof x.id === "string") : [];
    const next = [
      { id, name: sitter.name?.trim() || "Dogsitter", avatarUrl: sitter.avatarUrl ?? null },
      ...clean.filter((x) => x.id !== id),
    ].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore quota / parse errors
  }
}

export function getRecentSitters(): RecentSitter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentSitter[]) : [];
    return Array.isArray(list)
      ? list.filter((x) => x && typeof x.id === "string" && x.id.trim())
      : [];
  } catch {
    return [];
  }
}
