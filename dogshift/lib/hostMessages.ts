export type HostMessageDirection = "inbound" | "outbound";

export type HostMessageV1 = {
  id: string;
  hostSitterId: string;
  sitterId: string;
  clientName: string;
  clientEmail?: string;
  body: string;
  direction: HostMessageDirection;
  createdAt: string;
  readAt?: string;
};

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function hostMessagesStorageKey(hostSitterId: string) {
  return `ds_host_messages_${hostSitterId}`;
}

export function stableMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function loadHostMessages(hostSitterId: string): HostMessageV1[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(hostMessagesStorageKey(hostSitterId));
  if (!raw) return [];
  const parsed = safeParseJson(raw);
  if (!Array.isArray(parsed)) return [];

  const cleaned: HostMessageV1[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const m = item as Partial<HostMessageV1>;
    if (!m.id || typeof m.id !== "string") continue;
    if (!m.hostSitterId || typeof m.hostSitterId !== "string") continue;
    if (!m.sitterId || typeof m.sitterId !== "string") continue;
    if (!m.clientName || typeof m.clientName !== "string") continue;
    if (!m.body || typeof m.body !== "string") continue;
    if (!m.createdAt || typeof m.createdAt !== "string") continue;
    if (m.direction !== "inbound" && m.direction !== "outbound") continue;

    cleaned.push({
      id: m.id,
      hostSitterId: m.hostSitterId,
      sitterId: m.sitterId,
      clientName: m.clientName,
      clientEmail: typeof m.clientEmail === "string" ? m.clientEmail : undefined,
      body: m.body,
      direction: m.direction,
      createdAt: m.createdAt,
      readAt: typeof m.readAt === "string" ? m.readAt : undefined,
    });
  }

  return cleaned;
}

export function saveHostMessages(hostSitterId: string, messages: HostMessageV1[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(hostMessagesStorageKey(hostSitterId), JSON.stringify(messages));
}

export function appendHostMessage(hostSitterId: string, message: Omit<HostMessageV1, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
  const existing = loadHostMessages(hostSitterId);
  const next: HostMessageV1 = {
    id: message.id ?? stableMessageId(),
    createdAt: message.createdAt ?? new Date().toISOString(),
    hostSitterId,
    sitterId: message.sitterId,
    clientName: message.clientName,
    clientEmail: message.clientEmail,
    body: message.body,
    direction: message.direction,
    readAt: message.readAt,
  };
  const merged = [next, ...existing];
  saveHostMessages(hostSitterId, merged);
  return merged;
}

export function markHostThreadRead(hostSitterId: string, sitterId: string, clientName: string) {
  const existing = loadHostMessages(hostSitterId);
  const now = new Date().toISOString();
  const next = existing.map((m) => {
    const isThread = m.sitterId === sitterId && m.clientName === clientName;
    if (!isThread) return m;
    if (m.direction !== "inbound") return m;
    if (m.readAt) return m;
    return { ...m, readAt: now };
  });
  saveHostMessages(hostSitterId, next);
  return next;
}

export function getUnreadHostMessageCount(hostSitterId: string) {
  const existing = loadHostMessages(hostSitterId);
  return existing.filter((m) => m.direction === "inbound" && !m.readAt).length;
}
