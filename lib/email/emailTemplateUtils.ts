import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export type EmailTemplateRow = { subject: string; body: string };

/**
 * Active template for category: prefers is_default, then newest updated_at.
 */
export async function loadDefaultEmailTemplateForCategory(
  companyId: string,
  category: string
): Promise<EmailTemplateRow | null> {
  const { data: rows, error } = await supabaseAdmin
    .from("email_templates")
    .select("subject, body, is_default, updated_at")
    .eq("company_id", companyId)
    .eq("category", category)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[emailTemplateUtils] load template:", error.message);
    return null;
  }
  const row = rows?.[0] as { subject?: string; body?: string } | undefined;
  if (!row) return null;
  const subject = (row.subject ?? "").trim();
  const body = (row.body ?? "").trim();
  if (!subject && !body) return null;
  return { subject, body };
}
