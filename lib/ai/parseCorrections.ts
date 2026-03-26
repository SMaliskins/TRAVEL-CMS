import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export type DocumentType =
  | "flight"
  | "package_tour"
  | "passport"
  | "invoice"
  | "operator_confirmation"
  | "airline_ticket";

export interface ParseCorrection {
  id: string;
  document_type: DocumentType;
  context_hint: string | null;
  field_name: string;
  original_value: string | null;
  corrected_value: string;
  correction_rule: string | null;
  use_count: number;
}

export interface CorrectionInput {
  companyId: string;
  userId: string;
  documentType: DocumentType;
  contextHint?: string; // airline or operator name
  fieldName: string;
  originalValue?: string;
  correctedValue: string;
  correctionRule?: string;
  textFingerprint?: string;
}

/**
 * Save a user correction. If the same (company, docType, context, field, correctedValue)
 * already exists, increment use_count instead of creating a duplicate.
 */
export async function saveCorrection(input: CorrectionInput): Promise<void> {
  const admin = getAdmin();

  // Check for existing matching correction
  let query = admin
    .from("parse_corrections")
    .select("id, use_count")
    .eq("company_id", input.companyId)
    .eq("document_type", input.documentType)
    .eq("field_name", input.fieldName)
    .eq("corrected_value", input.correctedValue)
    .eq("is_active", true)
    .limit(1);

  if (input.contextHint) {
    query = query.eq("context_hint", input.contextHint);
  }

  const { data: existing } = await query;

  if (existing && existing.length > 0) {
    // Increment use_count — this correction is confirmed again
    await admin
      .from("parse_corrections")
      .update({
        use_count: (existing[0].use_count || 1) + 1,
        updated_at: new Date().toISOString(),
        // Update rule if provided (user may have refined it)
        ...(input.correctionRule
          ? { correction_rule: input.correctionRule }
          : {}),
      })
      .eq("id", existing[0].id);
    return;
  }

  // Insert new correction
  await admin.from("parse_corrections").insert({
    company_id: input.companyId,
    user_id: input.userId,
    document_type: input.documentType,
    context_hint: input.contextHint || null,
    field_name: input.fieldName,
    original_value: input.originalValue || null,
    corrected_value: input.correctedValue,
    correction_rule:
      input.correctionRule ||
      generateCorrectionRule(input),
    text_fingerprint: input.textFingerprint || null,
  });
}

/**
 * Save multiple corrections at once (batch from a single form submission).
 */
export async function saveCorrections(
  corrections: CorrectionInput[]
): Promise<void> {
  await Promise.all(corrections.map(saveCorrection));
}

/**
 * Find relevant corrections for a given document type and context.
 * Returns up to `limit` most-used corrections.
 */
export async function findCorrections(opts: {
  companyId: string;
  documentType: DocumentType;
  contextHint?: string;
  limit?: number;
}): Promise<ParseCorrection[]> {
  const admin = getAdmin();
  const max = opts.limit || 10;

  let query = admin
    .from("parse_corrections")
    .select(
      "id, document_type, context_hint, field_name, original_value, corrected_value, correction_rule, use_count"
    )
    .eq("company_id", opts.companyId)
    .eq("document_type", opts.documentType)
    .eq("is_active", true)
    .order("use_count", { ascending: false })
    .limit(max);

  if (opts.contextHint) {
    // Get context-specific corrections first, then generic ones
    query = query.or(
      `context_hint.eq.${opts.contextHint},context_hint.is.null`
    );
  }

  const { data } = await query;
  return (data || []) as ParseCorrection[];
}

/**
 * Build a prompt suffix with correction rules for the AI.
 * Injected into system prompt to teach the model from past user corrections.
 */
export function buildCorrectionPrompt(
  corrections: ParseCorrection[]
): string {
  if (corrections.length === 0) return "";

  const rules = corrections.map((c) => {
    if (c.correction_rule) return `- ${c.correction_rule}`;
    // Fallback: generate rule from original→corrected
    const context = c.context_hint ? ` (${c.context_hint})` : "";
    if (c.original_value) {
      return `- Field "${c.field_name}"${context}: when you see "${c.original_value}", the correct value is "${c.corrected_value}" (confirmed ${c.use_count}x)`;
    }
    return `- Field "${c.field_name}"${context}: should be "${c.corrected_value}" (confirmed ${c.use_count}x)`;
  });

  return `\n\nIMPORTANT — Learned correction rules from previous user feedback. Apply these rules:
${rules.join("\n")}
These corrections override your default behavior for the specific cases described.\n`;
}

/**
 * Auto-generate a human-readable correction rule from the input.
 */
function generateCorrectionRule(input: CorrectionInput): string {
  const context = input.contextHint ? ` for ${input.contextHint}` : "";
  if (input.originalValue) {
    return `When parsing "${input.fieldName}"${context}: if the text shows "${input.originalValue}", extract as "${input.correctedValue}" instead.`;
  }
  return `When parsing "${input.fieldName}"${context}: the correct value should be "${input.correctedValue}".`;
}
