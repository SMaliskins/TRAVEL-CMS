export function orderCodeToSlug(orderCode: string): string {
  // "0040/25-SM" → "0040-25-sm"
  // Replace "/" with "-" and convert to lowercase
  return orderCode.replace("/", "-").toLowerCase();
}

export function slugToOrderCode(slug: string): string {
  // "0040-25-sm" → "0040/25-SM"
  // Pattern: "XXXX-YY-XX" where first "-" should become "/"
  // Match pattern: digits-dash-digits-dash-letters
  const match = slug.match(/^(\d+)-(\d+)-([a-z]+)$/i);
  if (match) {
    const [, seq, year, initials] = match;
    return `${seq}/${year}-${initials.toUpperCase()}`;
  }
  // Fallback: replace first "-" with "/" and uppercase
  return slug.replace("-", "/").toUpperCase();
}

