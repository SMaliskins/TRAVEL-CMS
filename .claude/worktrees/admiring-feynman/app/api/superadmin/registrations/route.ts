import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/superadmin/registrations - List registration requests
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    const { data, error } = await supabaseAdmin
      .from("company_registrations")
      .select(`
        id,
        status,
        company_data,
        users_data,
        selected_plan_id,
        submitted_at,
        reviewed_at,
        rejection_reason,
        subscription_plans (
          name
        )
      `)
      .eq("status", status)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("[SuperAdmin Registrations] Error:", error);
      return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 });
    }

    const registrations = (data || []).map((r) => ({
      id: r.id,
      status: r.status,
      companyData: r.company_data,
      usersData: r.users_data,
      planName: (r.subscription_plans as { name?: string } | null)?.name || "Free",
      submittedAt: r.submitted_at,
      reviewedAt: r.reviewed_at,
      rejectionReason: r.rejection_reason,
    }));

    return NextResponse.json({ registrations });
  } catch (err) {
    console.error("[SuperAdmin Registrations] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
