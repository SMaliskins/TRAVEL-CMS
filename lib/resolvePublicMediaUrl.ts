/**
 * Turn stored Supabase Storage references into absolute URLs for <img src>.
 * DB sometimes holds only the object path inside the bucket (e.g. passport-xxx.jpg
 * or companyId/userId/avatar-xxx.png) while uploads use getPublicUrl (full URL).
 */
export function resolvePublicMediaUrl(
  raw: string | null | undefined,
  bucket: string = "avatars"
): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base) return t;
  const path = t.replace(/^\/+/, "");
  if (path.startsWith("storage/v1/")) {
    return `${base}/${path}`;
  }
  const encodedPath = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
}
