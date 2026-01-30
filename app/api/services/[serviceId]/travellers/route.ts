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
          phone,
          party_person (
            first_name,
            last_name,
            title,
            dob,
            personal_code
          )
        )
      `)
      .eq("service_id", serviceId)
      .eq("company_id", auth.companyId);

    if (error) {
      console.error("Error fetching service travellers:", error);
      return NextResponse.json({ error: "Failed to fetch travellers" }, { status: 500 });
    }

    console.log("[GET /api/services/travellers] serviceId:", serviceId, "found:", serviceTravellers?.length, "records");

    const travellerIds = (serviceTravellers || []).map(st => st.traveller_id);
    
    // Build travellers with names for Edit Service
    const travellers = (serviceTravellers || []).map(st => {
      const partyRaw = st.party as unknown;
      const party = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw as { 
        id: string; 
        display_name: string; 
        party_person: { first_name: string; last_name: string }[] 
      } | null;
      const person = party?.party_person?.[0];
      
      const firstName = person?.first_name || "";
      const lastName = person?.last_name || "";
      const name = [firstName, lastName].filter(Boolean).join(" ") || party?.display_name || "Unknown";
      
      return {
        id: st.traveller_id,
        name,
        firstName,
        lastName,
      };
    });

    console.log("[GET] Returning travellers:", travellers.length, travellers);
    return NextResponse.json({ travellerIds, travellers });
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

    console.log("[PUT /api/services/travellers] serviceId:", serviceId, "travellerIds:", travellerIds);

    // Validate that all travellerIds exist in party table
    if (travellerIds.length > 0) {
      const { data: validParties } = await supabaseAdmin
        .from("party")
        .select("id")
        .in("id", travellerIds)
        .eq("company_id", auth.companyId);

      console.log("[PUT] Valid parties found:", validParties?.length, "of", travellerIds.length);

      const validIds = new Set((validParties || []).map(p => p.id));
      const invalidIds = travellerIds.filter((id: string) => !validIds.has(id));
      
      if (invalidIds.length > 0) {
        console.log("[PUT] Skipping invalid traveller IDs (not in party):", invalidIds);
      }
      
      // Filter to only valid IDs
      const filteredTravellerIds = travellerIds.filter((id: string) => validIds.has(id));
      console.log("[PUT] Filtered travellerIds:", filteredTravellerIds);
      
      // Delete existing assignments
      await supabaseAdmin
        .from("order_service_travellers")
        .delete()
        .eq("service_id", serviceId)
        .eq("company_id", auth.companyId);

      // Insert new assignments with valid IDs only
      if (filteredTravellerIds.length > 0) {
        const insertData = filteredTravellerIds.map((travellerId: string) => ({
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

      return NextResponse.json({ success: true, travellerIds: filteredTravellerIds });
    }

    // Delete existing assignments if no travellers
    await supabaseAdmin
      .from("order_service_travellers")
      .delete()
      .eq("service_id", serviceId)
      .eq("company_id", auth.companyId);

    return NextResponse.json({ success: true, travellerIds: [] });
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

    // Add new travellers (validate first)
    if (Array.isArray(addTravellerIds) && addTravellerIds.length > 0) {
      // Validate IDs exist in party
      const { data: validParties } = await supabaseAdmin
        .from("party")
        .select("id")
        .in("id", addTravellerIds)
        .eq("company_id", auth.companyId);

      const validIds = (validParties || []).map(p => p.id);
      
      if (validIds.length > 0) {
        const insertData = validIds.map((travellerId: string) => ({
          company_id: auth.companyId,
          service_id: serviceId,
          traveller_id: travellerId,
        }));

        await supabaseAdmin
          .from("order_service_travellers")
          .upsert(insertData, { onConflict: "service_id,traveller_id" });
      }
    }

    // Return updated list
    const { data: updatedTravellers } = await supabaseAdmin
      .from("order_service_travellers")
      .select("traveller_id")
      .eq("service_id", serviceId)
      .eq("company_id", auth.companyId);

    const resultIds = (updatedTravellers || []).map(st => st.traveller_id);

    return NextResponse.json({ success: true, travellerIds: resultIds });
  } catch (error) {
    console.error("Service travellers PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
