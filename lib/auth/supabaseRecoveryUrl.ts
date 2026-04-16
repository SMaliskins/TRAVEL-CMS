/**
 * Recovery links from Supabase carry an access_token in the URL fragment.
 * The JWT `iss` identifies which Supabase project issued it — needed to pick the right anon key.
 */

function parseJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** e.g. https://abcdefgh.supabase.co from iss https://abcdefgh.supabase.co/auth/v1 */
export function getSupabaseProjectUrlFromRecoveryHash(fullHash: string): string | null {
  const h = fullHash.startsWith("#") ? fullHash.slice(1) : fullHash;
  const params = new URLSearchParams(h);
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  const payload = parseJwtPayload(accessToken);
  const iss = payload?.iss;
  if (typeof iss !== "string") return null;
  const m = iss.match(/^(https:\/\/[^/]+)/i);
  return m ? m[1] : null;
}

export function recoveryFragmentHasAccessToken(fullHash: string): boolean {
  const h = fullHash.startsWith("#") ? fullHash.slice(1) : fullHash;
  return new URLSearchParams(h).get("access_token") != null;
}
