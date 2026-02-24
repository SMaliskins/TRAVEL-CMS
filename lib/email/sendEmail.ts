/**
 * Send email via Resend API
 * Used by: send-to-hotel, invoice email, checkin notifications
 */
export type SendEmailResult =
  | { success: true; id?: string }
  | { success: false; reason: "no_api_key" | "api_error" | "exception"; error?: string };

export type EmailAttachment = { filename: string; content: Buffer };

export type SendEmailOptions = { from?: string };

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  attachments?: EmailAttachment[],
  options?: SendEmailOptions
): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.log("RESEND_API_KEY not set, skipping email send");
    return { success: false, reason: "no_api_key" };
  }

  const from = options?.from?.trim() || process.env.EMAIL_FROM || "Travel CMS <noreply@travel-cms.com>";
  const body: Record<string, unknown> = {
    from,
    to: [to],
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
        Authorization: `Bearer ${resendApiKey}`,
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
