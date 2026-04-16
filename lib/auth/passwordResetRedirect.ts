/**
 * URL Supabase uses after "Reset password" in email. Must exactly match an entry in
 * Supabase Dashboard → Authentication → URL configuration → Redirect URLs.
 *
 * Prefer NEXT_PUBLIC_SITE_URL (https://yourdomain.com) so redirects stay HTTPS even if
 * window.location is odd; matches production allowlist.
 */
export function getStaffPasswordResetRedirectUrl(): string {
  const path = "/reset-password";
  const envBase = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (envBase) {
    return `${envBase}${path}`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin.replace(/\/$/, "")}${path}`;
  }
  return path;
}
