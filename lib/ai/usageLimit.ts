import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface AiUsageStatus {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
}

/**
 * Check if a company can make AI calls this month.
 * Returns { allowed, limit, used, remaining }.
 * limit = -1 means unlimited.
 */
export async function checkAiUsageLimit(companyId: string): Promise<AiUsageStatus> {
  try {
    const { data, error } = await supabaseAdmin.rpc("check_ai_usage_limit", {
      p_company_id: companyId,
    });

    if (error || !data) {
      console.error("[AI Limit] RPC error:", error);
      return { allowed: true, limit: -1, used: 0, remaining: -1 };
    }

    return data as AiUsageStatus;
  } catch (e) {
    console.error("[AI Limit] Exception:", e);
    return { allowed: true, limit: -1, used: 0, remaining: -1 };
  }
}

/**
 * Get AI usage stats for a company (for display in settings).
 */
export async function getAiUsageStats(companyId: string): Promise<{
  status: AiUsageStatus;
  thisMonth: { calls: number; cost: number };
  byModel: Record<string, { calls: number; cost: number }>;
}> {
  const status = await checkAiUsageLimit(companyId);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: logs } = await supabaseAdmin
    .from("ai_usage_log")
    .select("model, estimated_cost_usd")
    .eq("company_id", companyId)
    .gte("created_at", monthStart.toISOString());

  let totalCost = 0;
  const byModel: Record<string, { calls: number; cost: number }> = {};

  for (const log of logs || []) {
    const cost = parseFloat(log.estimated_cost_usd) || 0;
    totalCost += cost;
    if (!byModel[log.model]) byModel[log.model] = { calls: 0, cost: 0 };
    byModel[log.model].calls += 1;
    byModel[log.model].cost += cost;
  }

  return {
    status,
    thisMonth: { calls: logs?.length || 0, cost: totalCost },
    byModel,
  };
}
