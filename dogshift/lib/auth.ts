export type DogShiftAuthUser = {
  id: "host-sitter";
  email: string;
  role: "sitter" | "owner";
  sitterId?: string;
  createdAt: string;
};

type DogShiftAuthUserStored = Omit<DogShiftAuthUser, "role"> & {
  role: DogShiftAuthUser["role"] | "host";
};

export type DogShiftAuthCredentials = {
  email: string;
  password: string;
  sitterId?: string;
};

export type DogShiftAuthRole = DogShiftAuthUser["role"];

const USER_KEY = "ds_auth_user";
const CREDS_KEY = "ds_auth_credentials";
const CREDS_INDEX_KEY = "ds_auth_credentials_index";

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function loadAuthCredentialsIndex(): DogShiftAuthCredentials[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CREDS_INDEX_KEY);
    if (!raw) return [];
    const parsed = safeParseJson(raw);
    if (!Array.isArray(parsed)) return [];

    const cleaned: DogShiftAuthCredentials[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const c = item as Partial<DogShiftAuthCredentials>;
      if (!c.email || typeof c.email !== "string") continue;
      if (!c.password || typeof c.password !== "string") continue;
      cleaned.push({ email: c.email, password: c.password, sitterId: typeof c.sitterId === "string" ? c.sitterId : undefined });
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveAuthCredentialsIndex(list: DogShiftAuthCredentials[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CREDS_INDEX_KEY, JSON.stringify(list));
}

export function authEmailExists(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const list = loadAuthCredentialsIndex();
  if (list.some((c) => c.email.trim().toLowerCase() === normalized)) return true;
  return false;
}

export function upsertAuthCredentialsIndex(creds: DogShiftAuthCredentials) {
  const normalized = creds.email.trim().toLowerCase();
  if (!normalized) return;
  const list = loadAuthCredentialsIndex();
  const idx = list.findIndex((c) => c.email.trim().toLowerCase() === normalized);
  const next = { ...creds, email: creds.email.trim() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  saveAuthCredentialsIndex(list);
}

export function loadAuthUser(): DogShiftAuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const u = parsed as Partial<DogShiftAuthUserStored>;

    const email = typeof u.email === "string" ? u.email : "";
    if (!email) return null;

    const storedRole = u.role;
    const normalizedRole: DogShiftAuthRole = storedRole === "owner" ? "owner" : "sitter";

    const sitterId = typeof u.sitterId === "string" ? u.sitterId : undefined;
    const createdAt = typeof u.createdAt === "string" ? u.createdAt : new Date().toISOString();

    return {
      id: "host-sitter",
      email,
      role: normalizedRole,
      sitterId,
      createdAt,
    };
  } catch {
    return null;
  }
}

export function getAuthUser() {
  return loadAuthUser();
}

export function loadAuthCredentials(): DogShiftAuthCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DogShiftAuthCredentials;
  } catch {
    return null;
  }
}

export function findAuthCredentialsByEmail(email: string): DogShiftAuthCredentials | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const list = loadAuthCredentialsIndex();
  const hit = list.find((c) => c.email.trim().toLowerCase() === normalized);
  if (hit) return hit;
  return null;
}

export function setAuthUser(user: DogShiftAuthUser) {
  if (typeof window === "undefined") return;

  const stored: DogShiftAuthUserStored = {
    ...user,
    role: user.role,
    sitterId: typeof user.sitterId === "string" ? user.sitterId : undefined,
  };
  window.localStorage.setItem(USER_KEY, JSON.stringify(stored));
}

export function saveAuthUser(user: DogShiftAuthUser) {
  setAuthUser(user);
}

export function getAuthRole(): DogShiftAuthRole | null {
  const user = getAuthUser();
  return user?.role ?? null;
}

export function isAuthed(): boolean {
  return Boolean(getAuthUser());
}

export function saveAuthCredentials(creds: DogShiftAuthCredentials) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
  try {
    upsertAuthCredentialsIndex(creds);
  } catch {
    // ignore
  }
}

export function logoutAuthUser() {
  logout();
}

export function logout() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_KEY);
    try {
      window.dispatchEvent(new StorageEvent("storage", { key: USER_KEY }));
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

export function getCurrentHostSitterId(): string | null {
  const user = loadAuthUser();
  if (user?.role !== "sitter") return null;
  const sitterId = user?.sitterId;
  if (!sitterId || typeof sitterId !== "string") return null;
  const trimmed = sitterId.trim();
  return trimmed ? trimmed : null;
}
