export function normalizeInvoiceLanguagePreference(language: unknown): string | null {
  if (typeof language !== "string") return null;
  const normalized = language.trim().toLowerCase();
  return normalized || null;
}

export function buildInvoiceLanguagePreferenceRequest(
  partyId: string | null | undefined,
  language: unknown,
  partyType: unknown
): { url: string; init: RequestInit } | null {
  const normalizedPartyId = typeof partyId === "string" ? partyId.trim() : "";
  const normalizedLanguage = normalizeInvoiceLanguagePreference(language);
  const normalizedPartyType = partyType === "person" ? "person" : partyType === "company" ? "company" : null;
  if (!normalizedPartyId || !normalizedLanguage || !normalizedPartyType) return null;

  return {
    url: `/api/directory/${encodeURIComponent(normalizedPartyId)}`,
    init: {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: normalizedPartyType, invoiceLanguage: normalizedLanguage }),
    },
  };
}
