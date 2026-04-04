/**
 * Mask {{placeholders}} before AI translation so they are returned unchanged.
 */
export function maskEmailTemplatePlaceholders(
  subject: string,
  bodyHtml: string
): {
  subjectMasked: string;
  bodyMasked: string;
  unmaskSubject: (s: string) => string;
  unmaskBody: (s: string) => string;
} {
  const placeholderToToken = new Map<string, string>();
  let idx = 0;
  const re = /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g;

  function mask(s: string): string {
    return s.replace(re, (full) => {
      let tok = placeholderToToken.get(full);
      if (!tok) {
        tok = `⟦PH${idx++}⟧`;
        placeholderToToken.set(full, tok);
      }
      return tok;
    });
  }

  const tokenToPlaceholder = new Map(
    [...placeholderToToken.entries()].map(([ph, tok]) => [tok, ph])
  );

  const unmask = (s: string): string => {
    let out = s;
    for (const [tok, ph] of tokenToPlaceholder) {
      out = out.split(tok).join(ph);
    }
    return out;
  };

  return {
    subjectMasked: mask(subject),
    bodyMasked: mask(bodyHtml),
    unmaskSubject: unmask,
    unmaskBody: unmask,
  };
}
