import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type EmailSignatureSource = "personal" | "company";

/** Same visual wrapper as legacy send-to-hotel / profile signature */
export function wrapHtmlEmailSignatureBlock(html: string, signatureHtml: string): string {
  const sig = signatureHtml.trim();
  if (!sig) return html;
  return `${html}<br><div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb">${sig}</div>`;
}

export function normalizeEmailSignatureSource(value: unknown): EmailSignatureSource {
  return value === "company" ? "company" : "personal";
}

/**
 * Appends signature per template setting:
 * - `company`: companies.email_signature (Company Settings)
 * - `personal`: user_profiles.email_signature (Settings → Profile)
 * If company signature is empty but source is company, falls back to personal.
 */
export async function appendHtmlWithEmailSignature(
  html: string,
  params: {
    source: EmailSignatureSource;
    userId: string | null | undefined;
    companyId: string | null | undefined;
  }
): Promise<string> {
  if (params.source === "company" && params.companyId) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("email_signature")
      .eq("id", params.companyId)
      .single();
    const companySig = (company as { email_signature?: string | null } | null)?.email_signature?.trim();
    if (companySig) {
      return wrapHtmlEmailSignatureBlock(html, companySig);
    }
  }
  return appendHtmlWithUserEmailSignature(html, params.userId);
}

/**
 * Appends the sender's HTML email signature from Settings → Profile (user_profiles.email_signature).
 */
export async function appendHtmlWithUserEmailSignature(
  html: string,
  userId: string | null | undefined
): Promise<string> {
  if (!userId?.trim()) return html;
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("email_signature")
    .eq("id", userId)
    .single();
  const sig = (profile as { email_signature?: string | null } | null)?.email_signature?.trim();
  if (!sig) return html;
  return wrapHtmlEmailSignatureBlock(html, sig);
}
