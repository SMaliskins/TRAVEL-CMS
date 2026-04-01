import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAiUsageLimit } from "@/lib/ai/usageLimit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function getAuthInfo(request: NextRequest): Promise<{ userId: string; companyId: string; role: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;

  const userId = data.user.id;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("company_id, role:roles(name)")
    .eq("id", userId)
    .single();

  if (!profile?.company_id) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleName = (profile.role as any)?.name || "";
  return { userId, companyId: profile.company_id, role: roleName };
}

export async function GET(request: NextRequest) {
  try {
    const authInfo = await getAuthInfo(request);
    if (!authInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["supervisor", "manager"].includes(authInfo.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // Templates
    const { data: templates } = await admin
      .from("flight_parse_templates")
      .select("id, airline_hint, source, use_count, created_at, updated_at")
      .or(`company_id.eq.${authInfo.companyId},company_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(50);

    // AI usage stats — this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: usageThisMonth } = await admin
      .from("ai_usage_log")
      .select("operation, model, input_tokens, output_tokens, total_tokens, estimated_cost_usd, success, created_at")
      .eq("company_id", authInfo.companyId)
      .gte("created_at", monthStart)
      .order("created_at", { ascending: false });

    // AI usage stats — all time
    const { data: usageAll } = await admin
      .from("ai_usage_log")
      .select("operation, model, total_tokens, estimated_cost_usd, success")
      .eq("company_id", authInfo.companyId);

    // Aggregate by model
    const byModel: Record<string, { calls: number; tokens: number; cost: number }> = {};
    const byOperation: Record<string, { calls: number; tokens: number; cost: number }> = {};
    let totalCost = 0;
    let totalCalls = 0;
    let totalTokens = 0;

    for (const row of usageAll || []) {
      const model = row.model || "unknown";
      const op = row.operation || "unknown";
      const cost = parseFloat(row.estimated_cost_usd) || 0;
      const tokens = row.total_tokens || 0;

      if (!byModel[model]) byModel[model] = { calls: 0, tokens: 0, cost: 0 };
      byModel[model].calls++;
      byModel[model].tokens += tokens;
      byModel[model].cost += cost;

      if (!byOperation[op]) byOperation[op] = { calls: 0, tokens: 0, cost: 0 };
      byOperation[op].calls++;
      byOperation[op].tokens += tokens;
      byOperation[op].cost += cost;

      totalCost += cost;
      totalCalls++;
      totalTokens += tokens;
    }

    // This month aggregates
    let monthCost = 0;
    let monthCalls = 0;
    for (const row of usageThisMonth || []) {
      monthCost += parseFloat(row.estimated_cost_usd) || 0;
      monthCalls++;
    }

    // Company AI settings
    const { data: company } = await admin
      .from("companies")
      .select(
        "openai_api_key_encrypted, openai_api_key_ciphertext, anthropic_api_key_encrypted, anthropic_api_key_ciphertext, ai_model_preference"
      )
      .eq("id", authInfo.companyId)
      .single();

    const hasOwnOpenAIKey = !!(company?.openai_api_key_ciphertext || company?.openai_api_key_encrypted);
    const hasOwnAnthropicKey = !!(company?.anthropic_api_key_ciphertext || company?.anthropic_api_key_encrypted);
    const modelPreference = company?.ai_model_preference || "auto";

    // Get AI usage limit status
    const usageLimit = await checkAiUsageLimit(authInfo.companyId);

    return NextResponse.json({
      templates: templates || [],
      usage: {
        allTime: { totalCalls, totalTokens, totalCost, byModel, byOperation },
        thisMonth: { calls: monthCalls, cost: monthCost },
        recentLogs: (usageThisMonth || []).slice(0, 20),
        limit: usageLimit,
      },
      config: {
        hasOwnOpenAIKey,
        hasOwnAnthropicKey,
        hasGlobalOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasGlobalAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        modelPreference,
      },
    });
  } catch (err) {
    console.error("AI parsing dashboard error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
