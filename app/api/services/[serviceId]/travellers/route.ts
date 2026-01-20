import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function getUserAndCompany(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  let user = null;
  
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) {
      user = data.user;
    }
  }

  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (cookieHeader) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Cookie: cookieHeader } },
      });
      const { data, error } = await authClient.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
      }
    }
  }

  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;

  return { userId: user.id, companyId: profile.company_id };
}

// GET: Get travellers assigned to a service
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    
    const auth = await getUserAndCompany(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify service exists and belongs to company
    const { data: service, error: serviceError } = await supabaseAdmin
      .from("order_services")
      .select("id, order_id")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Get traveller IDs for this service
    const { data: serviceTravellers, error } = await supabaseAdmin
      .from("order_service_travellers")
      .select(`
        traveller_id,
        party:traveller_id (
          id,
          display_name,
          party_person (
            first_name,
            last_name,
            title,
            dob,
            personal_code,
            phone
          )
        )
      `)
      .eq("service_id", serviceId)
      .eq("company_id", auth.companyId);

    if (error) {
      console.error("Error fetching service travellers:", error);
      return NextResponse.json({ error: "Failed to fetch travellers" }, { status: 500 });
    }

    const travellerIds = (serviceTravellers || []).map(st => st.traveller_id);

    return NextResponse.json({ travellerIds });
  } catch (error) {
    console.error("Service travellers GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT: Replace all travellers for a service
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const body = await request.json();
    
    const auth = await getUserAndCompany(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { travellerIds } = body;

    if (!Array.isArray(travellerIds)) {
      return NextResponse.json({ error: "travellerIds must be an array" }, { status: 400 });
    }

    // Verify service exists
    const { data: service, error: serviceError } = await supabaseAdmin
      .from("order_services")
      .select("id")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Delete existing assignments
    await supabaseAdmin
      .from("order_service_travellers")
      .delete()
      .eq("service_id", serviceId)
      .eq("company_id", auth.companyId);

    // Insert new assignments
    if (travellerIds.length > 0) {
      const insertData = travellerIds.map((travellerId: string) => ({
        company_id: auth.companyId,
        service_id: serviceId,
        traveller_id: travellerId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("order_service_travellers")
        .insert(insertData);

      if (insertError) {
        console.error("Error inserting service travellers:", insertError);
        return NextResponse.json({ error: "Failed to update travellers" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, travellerIds });
  } catch (error) {
    console.error("Service travellers PUT error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH: Add travellers to a service (without removing existing)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const body = await request.json();
    
    const auth = await getUserAndCompany(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { addTravellerIds, removeTravellerIds } = body;

    // Verify service exists
    const { data: service, error: serviceError } = await supabaseAdmin
      .from("order_services")
      .select("id")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Remove specified travellers
    if (Array.isArray(removeTravellerIds) && removeTravellerIds.length > 0) {
      await supabaseAdmin
        .from("order_service_travellers")
        .delete()
        .eq("service_id", serviceId)
        .eq("company_id", auth.companyId)
        .in("traveller_id", removeTravellerIds);
    }

    // Add new travellers (upsert to avoid duplicates)
    if (Array.isArray(addTravellerIds) && addTravellerIds.length > 0) {
      const insertData = addTravellerIds.map((travellerId: string) => ({
        company_id: auth.companyId,
        service_id: serviceId,
        traveller_id: travellerId,
      }));

      await supabaseAdmin
        .from("order_service_travellers")
        .upsert(insertData, { onConflict: "service_id,traveller_id" });
    }

    // Return updated list
    const { data: updatedTravellers } = await supabaseAdmin
      .from("order_service_travellers")
      .select("traveller_id")
      .eq("service_id", serviceId)
      .eq("company_id", auth.companyId);

    const travellerIds = (updatedTravellers || []).map(st => st.traveller_id);

    return NextResponse.json({ success: true, travellerIds });
  } catch (error) {
    console.error("Service travellers PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
