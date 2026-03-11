import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// PATCH /api/finances/invoices/[invoiceId]/process - Mark invoice as processed by accounting
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params;
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("role_id, role:roles(id, name)")
      .eq("id", user.id)
      .maybeSingle();

    const roleRaw = profile?.role as unknown;
    const roleObj = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw as { id: string; name: string } | null;
    const roleName = roleObj?.name || null;

    if (roleName !== "finance" && roleName !== "admin") {
      return NextResponse.json({ error: "Forbidden: only Finance role can process invoices" }, { status: 403 });
    }

    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from("invoices")
      .select("id, total, status")
      .eq("id", invoiceId)
      .maybeSingle();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const updatePayload = invoice.status === "cancelled"
      ? {
          processed_by: user.id,
          processed_at: new Date().toISOString(),
          processed_total: null as number | null,
        }
      : {
          status: "processed" as const,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
          processed_total: invoice.total,
        };

    const { error: updateError } = await supabaseAdmin
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in PATCH /api/finances/invoices/[invoiceId]/process:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
