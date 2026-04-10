/**
 * Build a single user-visible message from API JSON like `{ error, details?, message? }`.
 */
export function formatApiErrorResponse(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const o = data as { error?: string; details?: string; message?: string };
  const err = typeof o.error === "string" && o.error.trim() ? o.error.trim() : fallback;
  const raw = [o.details, o.message].find((x) => typeof x === "string" && x.trim());
  if (!raw) return err;
  const d = raw.trim();
  if (err.includes(d)) return err;
  return `${err}: ${d}`;
}
