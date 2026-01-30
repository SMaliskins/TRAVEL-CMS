import { supabaseAdmin } from "@/lib/supabaseAdmin";

// OpenAI pricing per 1M tokens (as of 2024)
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4-turbo": { input: 10.00, output: 30.00 },
  "gpt-4": { input: 30.00, output: 60.00 },
  "gpt-3.5-turbo": { input: 0.50, output: 1.50 },
};

interface UsageLogParams {
  companyId: string;
  userId: string;
  operation: "parse_flight" | "parse_package_tour" | "parse_hotel" | "other";
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
  const pricing = PRICING[model] || PRICING["gpt-4o"];
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
