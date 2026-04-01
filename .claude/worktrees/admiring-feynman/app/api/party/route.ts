import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toTitleCaseForDisplay } from "@/utils/nameFormat";

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) return null;
  return user;
}

async function getCompanyId(userId: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  
  return profile?.company_id || null;
}

// GET - Fetch all parties for the company
export async function GET(request: NextRequest) {
  try {
    console.log("[API /party] GET request");
    
    const user = await getCurrentUser(request);
    if (!user) {
      console.log("[API /party] Unauthorized - no user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      console.log("[API /party] No company for user:", user.id);
      return NextResponse.json({ error: "User has no company assigned" }, { status: 400 });
    }

    console.log("[API /party] Fetching parties for company:", companyId);

    // Fetch all active parties for the company (exclude archived/inactive for splits and selects)
    const { data: parties, error } = await supabaseAdmin
      .from("party")
      .select(`
        id,
        display_name,
        party_type,
        email,
        phone
      `)
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("display_name", { ascending: true });

    if (error) {
      console.error("[API /party] Database error:", error);
      return NextResponse.json({ error: `Failed to fetch parties: \${error.message}` }, { status: 500 });
    }

    console.log(`[API /party] Fetched \${parties?.length || 0} parties`);

    return NextResponse.json({ parties: parties || [] });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[API /party] Error:", errorMsg);
    return NextResponse.json({ error: `Server error: \${errorMsg}` }, { status: 500 });
  }
}

// POST - Create a new party
export async function POST(request: NextRequest) {
  try {
    console.log("[API /party] POST request");
    
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "User has no company assigned" }, { status: 400 });
    }

    const body = await request.json();
    const { display_name, party_type, email, phone } = body;

    if (!display_name || !party_type) {
      return NextResponse.json({ error: "Missing required fields: display_name, party_type" }, { status: 400 });
    }

    console.log("[API /party] Creating party:", display_name, party_type);

    // Standard format: first letter of each name part uppercase, rest lowercase
    const displayNameFormatted = party_type === "person"
      ? toTitleCaseForDisplay(String(display_name))
      : String(display_name).trim();

    // Create party
    const { data: newParty, error } = await supabaseAdmin
      .from("party")
      .insert({
        company_id: companyId,
        display_name: displayNameFormatted,
        party_type,
        email: email || null,
        phone: phone || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[API /party] Create error:", error);
      return NextResponse.json({ error: `Failed to create party: \${error.message}` }, { status: 500 });
    }

    console.log("[API /party] Created party:", newParty.id);

    return NextResponse.json({ party: newParty }, { status: 201 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[API /party] Error:", errorMsg);
    return NextResponse.json({ error: `Server error: \${errorMsg}` }, { status: 500 });
  }
}
