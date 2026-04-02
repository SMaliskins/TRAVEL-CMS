import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmailSignatureSource, type EmailSignatureSource } from "@/lib/email/appendUserEmailSignature";

/**
 * Replace {{placeholders}} in template subject/body (email_templates from settings).
 * Unknown keys become empty string.
 */
export function substituteEmailTemplatePlaceholders(
  template: string,
  vars: Record<string, string>
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key.toLowerCase()];
    return v != null ? v : "";
  });
}

export type EmailTemplateRow = {
  subject: string;
  body: string;
  email_signature_source: EmailSignatureSource;
};

function isLikelyMissingSignatureColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("email_signature_source") ||
    m.includes("schema cache") ||
    m.includes("column") && m.includes("does not exist")
  );
}

/**
 * Active template for category: prefers is_default, then newest updated_at.
 * If the DB has not been migrated with `email_signature_source`, falls back to a select without that column so subject/body still load.
 */
export async function loadDefaultEmailTemplateForCategory(
  companyId: string,
  category: string
): Promise<EmailTemplateRow | null> {
  const base = () =>
    supabaseAdmin
      .from("email_templates")
      .eq("company_id", companyId)
      .eq("category", category)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);

  let { data: rows, error } = await base().select(
    "subject, body, email_signature_source, is_default, updated_at"
  );

  if (error && isLikelyMissingSignatureColumnError(error.message || "")) {
    const retry = await base().select("subject, body, is_default, updated_at");
    rows = retry.data;
    error = retry.error;
    if (!error && rows?.[0]) {
      const r = rows[0] as { subject?: string; body?: string };
      const subject = (r.subject ?? "").trim();
      const body = (r.body ?? "").trim();
      const email_signature_source = normalizeEmailSignatureSource(undefined);
      if (!subject && !body) {
        return { subject: "", body: "", email_signature_source };
      }
      return { subject, body, email_signature_source };
    }
  }

  if (error) {
    console.error("[emailTemplateUtils] load template:", error.message);
    return null;
  }
  const row = rows?.[0] as { subject?: string; body?: string; email_signature_source?: string | null } | undefined;
  if (!row) return null;
  const subject = (row.subject ?? "").trim();
  const body = (row.body ?? "").trim();
  const email_signature_source = normalizeEmailSignatureSource(row.email_signature_source);
  // Keep row when subject+body empty so callers still read email_signature_source
  if (!subject && !body) {
    return { subject: "", body: "", email_signature_source };
  }
  return { subject, body, email_signature_source };
}
