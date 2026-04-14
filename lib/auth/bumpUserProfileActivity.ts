import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Records staff CRM API usage (throttled in DB ~1 min). Fire-and-forget; never throws to callers.
 */
export function scheduleBumpUserProfileActivity(userId: string, companyId: string): void {
  Promise.resolve().then(() => {
    void bumpUserProfileActivity(userId, companyId);
  });
}

async function bumpUserProfileActivity(userId: string, companyId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc("user_profile_bump_activity", {
      p_user_id: userId,
      p_company_id: companyId,
    });
    if (error) {
      console.warn("[bumpUserProfileActivity]", error.message);
    }
  } catch (e) {
    console.warn("[bumpUserProfileActivity]", e);
  }
}
