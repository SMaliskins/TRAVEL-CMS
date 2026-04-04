import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmailSignatureSource, type EmailSignatureSource } from "@/lib/email/appendUserEmailSignature";
import type { EmailTemplateTranslationsMap } from "@/lib/email/refreshEmailTemplateTranslations";

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
  /** AI-cached locales (not including en — master columns are English UI default). */
  translations?: EmailTemplateTranslationsMap | null;
};

/**
 * Use cached translation for locale when present; English always uses column subject/body.
 */
export function applyEmailTemplateLocale(
  row: EmailTemplateRow | null,
  locale: string | null | undefined
): EmailTemplateRow | null {
  if (!row) return null;
  const code = (locale || "").trim().toLowerCase();
  if (!code || code === "en") {
    return row;
  }
  const tr = row.translations?.[code];
  if (!tr) return row;
  const subj = (tr.subject ?? "").trim();
  const bod = (tr.body ?? "").trim();
  if (!subj && !bod) return row;
  return {
    ...row,
    subject: subj || row.subject,
    body: bod || row.body,
  };
}

function isLikelyMissingSignatureColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("email_signature_source") ||
    m.includes("schema cache") ||
    m.includes("column") && m.includes("does not exist")
  );
}

function isLikelyMissingTranslationsColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("translations") && (m.includes("does not exist") || m.includes("schema cache"));
}

/**
 * Active template for category: prefers is_default, then newest updated_at.
 * If the DB has not been migrated with `email_signature_source`, falls back to a select without that column so subject/body still load.
 */
export async function loadDefaultEmailTemplateForCategory(
  companyId: string,
  category: string
): Promise<EmailTemplateRow | null> {
  const base = (columns: string) =>
    supabaseAdmin
      .from("email_templates")
      .select(columns)
      .eq("company_id", companyId)
      .eq("category", category)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);

  let { data: rows, error } = await base(
    "subject, body, email_signature_source, translations, is_default, updated_at"
  );

  if (error && isLikelyMissingTranslationsColumnError(error.message || "")) {
    const retryTr = await base(
      "subject, body, email_signature_source, is_default, updated_at"
    );
    rows = retryTr.data;
    error = retryTr.error;
  }

  if (error && isLikelyMissingSignatureColumnError(error.message || "")) {
    const retry = await base("subject, body, is_default, updated_at");
    rows = retry.data;
    error = retry.error;
    if (!error && rows?.[0]) {
      const r = rows[0] as { subject?: string; body?: string };
      const subject = (r.subject ?? "").trim();
      const body = (r.body ?? "").trim();
      const email_signature_source = normalizeEmailSignatureSource(undefined);
      if (!subject && !body) {
        return { subject: "", body: "", email_signature_source, translations: null };
      }
      return { subject, body, email_signature_source, translations: null };
    }
  }

  if (error) {
    console.error("[emailTemplateUtils] load template:", error.message);
    return null;
  }
  const row = rows?.[0] as {
    subject?: string;
    body?: string;
    email_signature_source?: string | null;
    translations?: EmailTemplateTranslationsMap | null;
  } | undefined;
  if (!row) return null;
  const subject = (row.subject ?? "").trim();
  const body = (row.body ?? "").trim();
  const email_signature_source = normalizeEmailSignatureSource(row.email_signature_source);
  const translations =
    row.translations && typeof row.translations === "object" ? row.translations : null;
  // Keep row when subject+body empty so callers still read email_signature_source
  if (!subject && !body) {
    return { subject: "", body: "", email_signature_source, translations };
  }
  return { subject, body, email_signature_source, translations };
}
