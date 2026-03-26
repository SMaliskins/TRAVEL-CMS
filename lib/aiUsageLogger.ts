import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MODEL_PRICING, MODELS } from "@/lib/ai/config";

interface UsageLogParams {
  companyId: string;
  userId: string;
  operation: "parse_flight" | "parse_package_tour" | "parse_hotel" | "parse_passport" | "parse_flight_ticket" | "parse_invoice" | "parse_company_doc" | "parse_expense" | "other";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export async function logAiUsage(params: UsageLogParams): Promise<void> {
  const {
    companyId,
    userId,
    operation,
    model,
    inputTokens = 0,
    outputTokens = 0,
    totalTokens = inputTokens + outputTokens,
    success = true,
    errorMessage,
    metadata = {},
  } = params;

  // Calculate estimated cost
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[MODELS.OPENAI_VISION];
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;

  try {
    await supabaseAdmin.from("ai_usage_log").insert({
      company_id: companyId,
      user_id: userId,
      operation,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimatedCostUsd,
      success,
      error_message: errorMessage || null,
      metadata,
    });
  } catch (err) {
    // Don't fail the main operation if logging fails
    console.error("[AI Usage Logger] Failed to log usage:", err);
  }
}

export async function getCompanyUsageStats(
  companyId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCalls: number;
  totalTokens: number;
  estimatedCostUsd: number;
  byOperation: Record<string, { calls: number; tokens: number; cost: number }>;
}> {
  let query = supabaseAdmin
    .from("ai_usage_log")
    .select("operation, total_tokens, estimated_cost_usd")
    .eq("company_id", companyId);

  if (startDate) {
    query = query.gte("created_at", startDate.toISOString());
  }
  if (endDate) {
    query = query.lte("created_at", endDate.toISOString());
  }

  const { data, error } = await query;

  if (error || !data) {
    return {
      totalCalls: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      byOperation: {},
    };
  }

  const byOperation: Record<string, { calls: number; tokens: number; cost: number }> = {};
  let totalCalls = 0;
  let totalTokens = 0;
  let estimatedCostUsd = 0;

  for (const row of data) {
    totalCalls++;
    totalTokens += row.total_tokens || 0;
    estimatedCostUsd += parseFloat(row.estimated_cost_usd) || 0;

    if (!byOperation[row.operation]) {
      byOperation[row.operation] = { calls: 0, tokens: 0, cost: 0 };
    }
    byOperation[row.operation].calls++;
    byOperation[row.operation].tokens += row.total_tokens || 0;
    byOperation[row.operation].cost += parseFloat(row.estimated_cost_usd) || 0;
  }

  return { totalCalls, totalTokens, estimatedCostUsd, byOperation };
}
