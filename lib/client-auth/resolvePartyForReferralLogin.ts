import type { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

/** Invisible chars sometimes break copy-paste from CRM / messengers. */
export function cleanEmailInput(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

/**
 * Postgres `=` on text is case-sensitive. Login normalizes to lowercase, CRM may store mixed case.
 */
function emailVariants(emailRaw: string): string[] {
  const cleaned = cleanEmailInput(emailRaw);
  const lower = cleaned.toLowerCase();
  if (!lower) return [];
  return cleaned === lower ? [lower] : [lower, cleaned];
}

type ProfileRow = { id: string; password_hash: string; crm_client_id: string };

function passwordCompareCandidates(plain: string): string[] {
  const trimmed = plain.trim();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of [plain, trimmed]) {
    if (s.length > 0 && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/**
 * Finds party ids that match this login email (party.email and party_person.email, all case variants).
 */
async function collectPartyIdsForEmail(supabase: SupabaseClient, emailRaw: string): Promise<string[]> {
  const variants = emailVariants(emailRaw);
  if (variants.length === 0) return [];

  const partyIds = new Set<string>();

  for (const v of variants) {
    const { data, error } = await supabase.from("party").select("id").eq("email", v);
    if (error) {
      console.warn("[referral login] party email:", error.message);
      continue;
    }
    for (const row of data || []) partyIds.add(row.id as string);
  }

  for (const v of variants) {
    const { data, error } = await supabase.from("party_person").select("party_id").eq("email", v);
    if (error) {
      if (!/column|schema cache/i.test(error.message)) {
        console.warn("[referral login] party_person email:", error.message);
      }
      continue;
    }
    for (const row of data || []) partyIds.add(row.party_id as string);
  }

  // Case-insensitive match when `=` found nothing (skip if pattern would use ILIKE wildcards).
  const primary = variants[0];
  if (partyIds.size === 0 && primary && !/[%_]/.test(primary)) {
    const { data, error } = await supabase.from("party").select("id").ilike("email", primary);
    if (!error) {
      for (const row of data || []) partyIds.add(row.id as string);
    }
    const pp = await supabase.from("party_person").select("party_id").ilike("email", primary);
    if (!pp.error) {
      for (const row of pp.data || []) partyIds.add(row.party_id as string);
    }
  }

  return [...partyIds];
}

/**
 * One lookup + password verify. Handles:
 * - case-mismatched party.email
 * - several parties sharing the same email (picks the row whose password matches)
 * - party_person.email fallback
 */
export async function authenticateReferralPortalCredentials(
  supabase: SupabaseClient,
  emailRaw: string,
  plainPassword: string
): Promise<{ profileId: string; crmClientId: string } | null> {
  const partyIds = await collectPartyIdsForEmail(supabase, emailRaw);
  if (partyIds.length === 0) return null;

  const { data: profiles, error: pErr } = await supabase
    .from("client_profiles")
    .select("id, password_hash, crm_client_id")
    .in("crm_client_id", partyIds);

  if (pErr) {
    console.warn("[referral login] client_profiles:", pErr.message);
    return null;
  }

  const withPwd = (profiles || []).filter(
    (p): p is ProfileRow =>
      Boolean(p.id && p.crm_client_id && p.password_hash && String(p.password_hash).length > 0)
  );

  if (withPwd.length === 0) return null;

  for (const p of withPwd) {
    for (const candidate of passwordCompareCandidates(plainPassword)) {
      try {
        const ok = await bcrypt.compare(candidate, p.password_hash);
        if (ok) {
          return { profileId: p.id, crmClientId: p.crm_client_id };
        }
      } catch (e) {
        console.warn("[referral login] bcrypt compare:", e);
      }
    }
  }

  return null;
}
