import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Appends the sender's HTML email signature from Settings → Profile (user_profiles.email_signature).
 * Company-wide templates stay unchanged; only this block is per user.
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
  return `${html}<br><div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb">${sig}</div>`;
}
