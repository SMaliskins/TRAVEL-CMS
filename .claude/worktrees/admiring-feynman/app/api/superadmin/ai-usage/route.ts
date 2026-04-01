import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/superadmin/ai-usage - AI usage statistics for all companies
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";

    let startDate: Date | null = null;
    if (period === "month") {
      startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    // Build query
    let query = supabaseAdmin
      .from("ai_usage_log")
      .select(`
        company_id,
        operation,
        total_tokens,
        estimated_cost_usd,
        created_at
      `);

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }

    const { data: usageData, error } = await query;

    if (error) {
      console.error("[SuperAdmin AI Usage] Error:", error);
      return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
    }

    // Aggregate stats
    let totalCalls = 0;
    let totalTokens = 0;
    let estimatedCostUsd = 0;
    const byOperation: Record<string, { calls: number; tokens: number; cost: number }> = {};
    const byCompanyMap: Record<string, { calls: number; tokens: number; cost: number }> = {};

    for (const row of usageData || []) {
      totalCalls++;
      totalTokens += row.total_tokens || 0;
      const cost = parseFloat(row.estimated_cost_usd) || 0;
      estimatedCostUsd += cost;

      // By operation
      if (!byOperation[row.operation]) {
        byOperation[row.operation] = { calls: 0, tokens: 0, cost: 0 };
      }
      byOperation[row.operation].calls++;
      byOperation[row.operation].tokens += row.total_tokens || 0;
      byOperation[row.operation].cost += cost;

      // By company
      if (!byCompanyMap[row.company_id]) {
        byCompanyMap[row.company_id] = { calls: 0, tokens: 0, cost: 0 };
      }
      byCompanyMap[row.company_id].calls++;
      byCompanyMap[row.company_id].tokens += row.total_tokens || 0;
      byCompanyMap[row.company_id].cost += cost;
    }

    // Get company names
    const companyIds = Object.keys(byCompanyMap);
    let companyNames: Record<string, string> = {};

    if (companyIds.length > 0) {
      const { data: companies } = await supabaseAdmin
        .from("companies")
        .select("id, name")
        .in("id", companyIds);

      companyNames = (companies || []).reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {} as Record<string, string>);
    }

    // Build byCompany array sorted by cost
    const byCompany = Object.entries(byCompanyMap)
      .map(([companyId, data]) => ({
        companyId,
        companyName: companyNames[companyId] || "Unknown",
        ...data,
      }))
      .sort((a, b) => b.cost - a.cost);

    return NextResponse.json({
      totalCalls,
      totalTokens,
      estimatedCostUsd,
      byOperation,
      byCompany,
      period,
    });
  } catch (err) {
    console.error("[SuperAdmin AI Usage] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
