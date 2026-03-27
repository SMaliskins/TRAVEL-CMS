/**
 * Send email via Resend API
 * Used by: send-to-hotel, invoice email, checkin notifications
 *
 * Supports per-company Resend API keys: pass `options.resendApiKey` to use
 * the company's own key. Falls back to global `RESEND_API_KEY` env var.
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptSecret } from "@/lib/security/secrets";

export type SendEmailResult =
  | { success: true; id?: string }
  | { success: false; reason: "no_api_key" | "api_error" | "exception"; error?: string };

export type EmailAttachment = { filename: string; content: Buffer };

export type SendEmailOptions = {
  from?: string;
  resendApiKey?: string;
  companyId?: string;
};

/**
 * Resolve the Resend API key and "from" address for a company.
 * Priority: options.resendApiKey > company DB record > global env.
 */
export async function resolveEmailConfig(
  companyId?: string | null,
  overrideKey?: string | null,
  overrideFrom?: string | null
): Promise<{ apiKey: string | null; from: string }> {
  const defaultFrom = process.env.EMAIL_FROM || "Travel CMS <noreply@travel-cms.com>";

  if (overrideKey) {
    return { apiKey: overrideKey, from: overrideFrom?.trim() || defaultFrom };
  }

  if (companyId) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("resend_api_key, resend_api_key_ciphertext, invoice_email_from, legal_name, trading_name, name")
      .eq("id", companyId)
      .single();

    const companyApiKey = decryptSecret(company?.resend_api_key_ciphertext) || company?.resend_api_key || null;
    if (company && companyApiKey) {
      const displayName = company.legal_name || company.trading_name || company.name || "";
      const emailAddr = company.invoice_email_from?.trim();
      const from = emailAddr && displayName
        ? `${displayName} <${emailAddr}>`
        : emailAddr || overrideFrom?.trim() || defaultFrom;
      return { apiKey: companyApiKey, from };
    }
  }

  return { apiKey: process.env.RESEND_API_KEY || null, from: overrideFrom?.trim() || defaultFrom };
}

/**
 * Unwrap `<addr@host>` to `addr@host`. Resend rejects a `to` value that is only
 * angle brackets around an address; `Name <addr@host>` is left unchanged.
 */
function normalizeSingleToAddress(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
    if (!s) return "";
  }
  const bracketOnly = s.match(/^<\s*([^\s<>]+@[^\s<>]+)\s*>$/);
  if (bracketOnly) return bracketOnly[1].trim();
  return s;
}

/** Comma-separated recipients; each segment normalized for API compatibility. */
export function normalizeEmailToField(value: string): string {
  return String(value)
    .split(",")
    .map((part) => normalizeSingleToAddress(part))
    .filter(Boolean)
    .join(", ");
}

/** Parse "a@x.com, b@y.com" into ["a@x.com", "b@y.com"]. */
function parseToAddresses(to: string | string[]): string[] {
  if (Array.isArray(to)) {
    return to.flatMap((s) =>
      String(s)
        .split(",")
        .map((e) => normalizeSingleToAddress(e))
        .filter(Boolean)
    );
  }
  return String(to)
    .split(",")
    .map((e) => normalizeSingleToAddress(e))
    .filter(Boolean);
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  text?: string,
  attachments?: EmailAttachment[],
  options?: SendEmailOptions
): Promise<SendEmailResult> {
  const { apiKey, from: resolvedFrom } = await resolveEmailConfig(
    options?.companyId,
    options?.resendApiKey,
    options?.from
  );

  if (!apiKey) {
    console.log("No Resend API key available (neither company nor global), skipping email send");
    return { success: false, reason: "no_api_key" };
  }

  const toList = parseToAddresses(to);
  if (toList.length === 0) {
    return { success: false, reason: "api_error", error: "No valid email addresses" };
  }

  const from = options?.from?.trim() || resolvedFrom;
  const body: Record<string, unknown> = {
    from,
    to: toList,
    subject,
    html,
    text: text ?? html.replace(/<[^>]*>/g, ""),
  };
  if (attachments?.length) {
    body.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
    }));
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send email:", error);
      return { success: false, reason: "api_error", error };
    }

    const result = (await response.json()) as { id?: string };
    return { success: true, id: result.id };
  } catch (error) {
    console.error("Email send error:", error);
    return {
      success: false,
      reason: "exception",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
