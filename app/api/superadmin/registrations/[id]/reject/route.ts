import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/superadmin/registrations/[id]/reject - Reject registration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { admin } = authResult;
  const { id } = await params;

  try {
    const body = await request.json();
    const { reason } = body;

    // Get registration
    const { data: registration, error: fetchError } = await supabaseAdmin
      .from("company_registrations")
      .select("id, status")
      .eq("id", id)
      .eq("status", "pending")
      .single();

    if (fetchError || !registration) {
      return NextResponse.json(
        { error: "Registration not found or already processed" },
        { status: 404 }
      );
    }

    // Update status
    const { error: updateError } = await supabaseAdmin
      .from("company_registrations")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
        rejection_reason: reason || null,
      })
      .eq("id", id);

    if (updateError) {
      console.error("[Reject Registration] Update error:", updateError);
      return NextResponse.json({ error: "Failed to reject" }, { status: 500 });
    }

    // TODO: Send rejection email

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Reject Registration] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
