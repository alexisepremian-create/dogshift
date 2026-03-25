type GetUserPhoneInput = {
  userId?: string | null;
  phone?: unknown;
  hostProfileJson?: unknown;
};

function phoneFromHostProfileJson(hostProfileJson: unknown) {
  const raw = typeof hostProfileJson === "string" ? hostProfileJson : "";
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as any;
    const phone = typeof parsed?.phone === "string" ? parsed.phone.trim() : "";
    return phone;
  } catch {
    return "";
  }
}

export function getUserPhone(input: GetUserPhoneInput): string {
  const primary = typeof input.phone === "string" ? input.phone.trim() : "";
  if (primary) return primary;

  const fallback = phoneFromHostProfileJson(input.hostProfileJson);
  if (fallback) {
    console.info("[user][phone] fallback hostProfileJson.phone used", { userId: input.userId ?? null });
    return fallback;
  }

  return "";
}

