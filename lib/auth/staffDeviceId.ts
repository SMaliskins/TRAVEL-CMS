const STORAGE_KEY = "tcms_staff_device_id";

/** Stable per-browser profile ID for session heartbeat (localStorage; not a security boundary). */
export function getOrCreateStaffDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (id && id.length >= 16) return id;
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `${Date.now()}-fallback`;
  }
}
