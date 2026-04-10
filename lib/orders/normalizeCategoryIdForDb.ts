const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `travel_service_categories.id` is uuid. The UI uses placeholders like `fallback-flight`
 * when the API list is empty — those must not be sent to Postgres.
 */
export function normalizeCategoryIdForDb(id: unknown): string | null {
  if (id == null) return null;
  const s = String(id).trim();
  if (!s) return null;
  if (s.startsWith("fallback-")) return null;
  if (!UUID_RE.test(s)) return null;
  return s;
}
