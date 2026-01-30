import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCompanyUsageStats } from "@/lib/aiUsageLogger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function getAuthInfo(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  
  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;
  
  const userId = data.user.id;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  
  if (!profile?.company_id) return null;
  return { userId, companyId: profile.company_id };
}

/**
 * GET /api/ai/usage - Get AI usage statistics for current company
 * 
 * Query params:
 *   - period: "month" | "all" (default: "month")
 *   - startDate: ISO date string (optional, overrides period)
 *   - endDate: ISO date string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const authInfo = await getAuthInfo(request);
    if (!authInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateParam) {
      startDate = new Date(startDateParam);
    } else if (period === "month") {
      // Current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    // For "all" period, startDate remains undefined

    if (endDateParam) {
      endDate = new Date(endDateParam);
    }

    const stats = await getCompanyUsageStats(authInfo.companyId, startDate, endDate);

    return NextResponse.json({
      companyId: authInfo.companyId,
      period: startDateParam ? "custom" : period,
      startDate: startDate?.toISOString() || null,
      endDate: endDate?.toISOString() || null,
      ...stats,
    });
  } catch (err) {
    console.error("AI usage stats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
