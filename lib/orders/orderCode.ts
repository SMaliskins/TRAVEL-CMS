export function orderCodeToSlug(orderCode: string): string {
  // "0040/25-SM" → "0040-25-sm"
  // Replace "/" with "-" and convert to lowercase
  return orderCode.replace("/", "-").toLowerCase();
}

export function slugToOrderCode(slug: string): string {
  const s = slug.trim();
  // Already canonical from API path (e.g. decoded 0146/26-SM) — do not corrupt with replace("-", "/")
  if (s.includes("/")) return s;
  // "0040-25-sm" → "0040/25-SM"
  const match = s.match(/^(\d+)-(\d+)-([a-z0-9]+)$/i);
  if (match) {
    const [, seq, year, initials] = match;
    return `${seq}/${year}-${initials.toUpperCase()}`;
  }
  return s.replace("-", "/").toUpperCase();
}

