import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompanyIdForCmsUser, getCurrentCmsUser } from "@/lib/hotels/cmsAuth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentCmsUser(request);
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized", message: "Auth required" }, { status: 401 });
    }
    const companyId = await getCompanyIdForCmsUser(user.id);
    if (!companyId) {
      return NextResponse.json({ data: null, error: "Company not found", message: "User has no company" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("hotel_offer_events")
      .select("*")
      .eq("offer_id", id)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ data: null, error: "Fetch failed", message: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [], error: null, message: "Events loaded" });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
