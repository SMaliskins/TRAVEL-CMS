function stringifyErrorField(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "object" && v !== null && "message" in v) {
    const m = (v as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return null;
}

/**
 * Build a single user-visible message from API JSON like `{ error, details?, message?, hint?, code? }`
 * or Supabase/PostgREST-style bodies.
 */
export function formatApiErrorResponse(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const o = data as {
    error?: unknown;
    details?: unknown;
    message?: unknown;
    hint?: unknown;
    code?: unknown;
  };
  const err =
    stringifyErrorField(o.error) ??
    (typeof o.message === "string" && o.message.trim() ? o.message.trim() : null) ??
    fallback;

  const parts: string[] = [];
  const push = (v: unknown) => {
    const s = stringifyErrorField(v);
    if (s && !parts.includes(s)) parts.push(s);
  };
  push(o.details);
  push(o.message);
  push(o.hint);
  const code = stringifyErrorField(o.code);
  if (code) parts.push(`code ${code}`);

  const detailLine = parts.filter((p) => p !== err).join(" — ");
  if (!detailLine) return err;
  if (err.includes(detailLine)) return err;
  return `${err}: ${detailLine}`;
}

/**
 * Parse fetch error body: prefer JSON, else return a short text snippet + status.
 */
export async function parseFetchErrorBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text?.trim()) return { error: `HTTP ${response.status}`, details: response.statusText || undefined };
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 280);
    return {
      error: `HTTP ${response.status}`,
      details: snippet || response.statusText || undefined,
    };
  }
}
