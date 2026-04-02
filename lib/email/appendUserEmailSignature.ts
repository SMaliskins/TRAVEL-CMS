import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type EmailSignatureSource = "personal" | "company";

export type AppendSignatureOptions = {
  /** When false, no border above the signature block (e.g. invoice email). Default true. */
  borderTop?: boolean;
};

/** Same visual wrapper as legacy send-to-hotel / profile signature */
export function wrapHtmlEmailSignatureBlock(
  html: string,
  signatureHtml: string,
  options?: AppendSignatureOptions
): string {
  const sig = signatureHtml.trim();
  if (!sig) return html;
  const borderTop = options?.borderTop !== false;
  const boxStyle = borderTop
    ? "margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb"
    : "margin-top:16px;padding-top:12px";
  return `${html}<br><div style="${boxStyle}">${sig}</div>`;
}

export function normalizeEmailSignatureSource(value: unknown): EmailSignatureSource {
  return value === "company" ? "company" : "personal";
}

export type ResolveEmailSignatureParams = {
  source: EmailSignatureSource;
  userId: string | null | undefined;
  companyId: string | null | undefined;
};

/**
 * Resolved HTML fragment for the signature (inner content only), or null if none.
 * Company source: companies.email_signature; empty → personal fallback.
 * Personal: user_profiles.email_signature.
 */
export async function resolveEmailSignatureInnerHtml(
  params: ResolveEmailSignatureParams
): Promise<string | null> {
  if (params.source === "company" && params.companyId) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("email_signature")
      .eq("id", params.companyId)
      .single();
    const companySig = (company as { email_signature?: string | null } | null)?.email_signature?.trim();
    if (companySig) return companySig;
  }
  if (!params.userId?.trim()) return null;
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("email_signature")
    .eq("id", params.userId)
    .single();
  const sig = (profile as { email_signature?: string | null } | null)?.email_signature?.trim();
  return sig || null;
}

/**
 * Appends signature per template setting:
 * - `company`: companies.email_signature (Company Settings)
 * - `personal`: user_profiles.email_signature (Settings → Profile)
 * If company signature is empty but source is company, falls back to personal.
 */
export async function appendHtmlWithEmailSignature(
  html: string,
  params: ResolveEmailSignatureParams,
  options?: AppendSignatureOptions
): Promise<string> {
  const inner = await resolveEmailSignatureInnerHtml(params);
  if (!inner) return html;
  return wrapHtmlEmailSignatureBlock(html, inner, options);
}

/**
 * Appends the sender's HTML email signature from Settings → Profile (user_profiles.email_signature).
 */
export async function appendHtmlWithUserEmailSignature(
  html: string,
  userId: string | null | undefined,
  options?: AppendSignatureOptions
): Promise<string> {
  return appendHtmlWithEmailSignature(
    html,
    { source: "personal", userId, companyId: null },
    options
  );
}
