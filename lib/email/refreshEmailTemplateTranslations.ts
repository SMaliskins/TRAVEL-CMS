import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { translateEmailSubjectAndBody } from "@/lib/ai/tasks/translateText";
import { isAIAvailable } from "@/lib/ai/config";
import { INVOICE_LANGUAGE_OPTIONS } from "@/lib/invoiceLanguages";
import { maskEmailTemplatePlaceholders } from "@/lib/email/maskEmailTemplatePlaceholders";

/** Persisted shape for email_templates.translations */
export type EmailTemplateTranslationsMap = Record<
  string,
  { subject: string; body: string }
>;

/**
 * After saving a template (subject/body), translate master copy to all invoice UI locales
 * except English (English is always served from subject/body columns).
 */
export async function refreshEmailTemplateTranslations(
  templateId: string,
  subject: string,
  bodyHtml: string
): Promise<void> {
  const subj = subject.trim();
  const body = bodyHtml.trim();

  if (!isAIAvailable("fast")) {
    const { error } = await supabaseAdmin
      .from("email_templates")
      .update({ translations: {} })
      .eq("id", templateId);
    if (error) console.error("[refreshEmailTemplateTranslations] clear:", error.message);
    return;
  }

  if (!subj && !body) {
    const { error } = await supabaseAdmin
      .from("email_templates")
      .update({ translations: {} })
      .eq("id", templateId);
    if (error) console.error("[refreshEmailTemplateTranslations] empty:", error.message);
    return;
  }

  const {
    subjectMasked,
    bodyMasked,
    unmaskSubject,
    unmaskBody,
  } = maskEmailTemplatePlaceholders(subj, body);

  const out: EmailTemplateTranslationsMap = {};

  for (const { value } of INVOICE_LANGUAGE_OPTIONS) {
    if (value === "en") continue;
    try {
      const tr = await translateEmailSubjectAndBody(subjectMasked, bodyMasked, value);
      if (tr) {
        out[value] = {
          subject: unmaskSubject(tr.subject),
          body: unmaskBody(tr.message),
        };
      }
    } catch (e) {
      console.error(`[refreshEmailTemplateTranslations] ${value}:`, e);
    }
  }

  const { error } = await supabaseAdmin
    .from("email_templates")
    .update({ translations: out })
    .eq("id", templateId);

  if (error) {
    console.error("[refreshEmailTemplateTranslations] save:", error.message);
  }
}
