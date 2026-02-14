import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";

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

// GET: Fetch travellers for an order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;
    
    const auth = await getUserAndCompany(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get order ID from order_code
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, client_party_id")
      .eq("company_id", auth.companyId)
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Auto-add main client to order_travellers if not exists
    console.log("Order data:", { orderId: order.id, clientPartyId: order.client_party_id });
    
    if (order.client_party_id) {
      // Check if main client already exists
      const { data: existingRecords } = await supabaseAdmin
        .from("order_travellers")
        .select("id")
        .eq("order_id", order.id)
        .eq("party_id", order.client_party_id);

      console.log("Check existing main client:", { existingRecords });

      if (!existingRecords || existingRecords.length === 0) {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("order_travellers")
          .insert({
            company_id: auth.companyId,
            order_id: order.id,
            party_id: order.client_party_id,
            is_main_client: true,
          })
          .select();
        
        console.log("Insert main client result:", { inserted, insertError });
      }
    }

    // Fetch order travellers with party details
    const { data: travellers, error } = await supabaseAdmin
      .from("order_travellers")
      .select(`
        id,
        party_id,
        is_main_client,
        created_at,
        party:party_id (
          id,
          display_name,
          phone,
          email,
          party_person (
            first_name,
            last_name,
            title,
            dob,
            personal_code
          )
        )
      `)
      .eq("order_id", order.id)
      .eq("company_id", auth.companyId);

    console.log("Fetched travellers:", { count: travellers?.length, travellers, error });

    if (error) {
      console.error("Error fetching travellers:", error);
      return NextResponse.json({ error: "Failed to fetch travellers" }, { status: 500 });
    }

    // Transform to frontend format
    const formattedTravellers = (travellers || []).map((t) => {
      // Handle both single object and array return from Supabase join
      const partyRaw = t.party as unknown;
      const party = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw as { id: string; display_name: string; phone: string; email: string; party_person: { first_name: string; last_name: string; title: string; dob: string; personal_code: string }[] } | null;
      const person = party?.party_person?.[0];
      
      return {
        id: t.party_id,
        firstName: person?.first_name || party?.display_name?.split(" ")[0] || "",
        lastName: person?.last_name || party?.display_name?.split(" ").slice(1).join(" ") || "",
        title: person?.title || "Mr",
        dob: person?.dob || null,
        personalCode: person?.personal_code || null,
        contactNumber: party?.phone || null,
        isMainClient: t.is_main_client || t.party_id === order.client_party_id,
      };
    });

    return NextResponse.json({ travellers: formattedTravellers });
  } catch (error) {
    console.error("Travellers GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: Add a traveller to order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;
    const body = await request.json();
    
    const auth = await getUserAndCompany(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get order ID
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, client_party_id")
      .eq("company_id", auth.companyId)
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { partyId, isMainClient } = body;

    if (!partyId) {
      return NextResponse.json({ error: "partyId is required" }, { status: 400 });
    }

    // Verify party exists and belongs to company
    const { data: party, error: partyError } = await supabaseAdmin
      .from("party")
      .select("id")
      .eq("id", partyId)
      .eq("company_id", auth.companyId)
      .single();

    if (partyError || !party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    // Insert order_traveller (upsert to handle duplicates)
    const { data: traveller, error: insertError } = await supabaseAdmin
      .from("order_travellers")
      .upsert({
        company_id: auth.companyId,
        order_id: order.id,
        party_id: partyId,
        is_main_client: isMainClient || partyId === order.client_party_id,
      }, {
        onConflict: "order_id,party_id",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error adding traveller:", insertError);
      return NextResponse.json({ error: "Failed to add traveller" }, { status: 500 });
    }

    return NextResponse.json({ traveller });
  } catch (error) {
    console.error("Travellers POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
