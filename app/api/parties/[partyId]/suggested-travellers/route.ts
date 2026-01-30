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

interface TravellerInfo {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  dob: string | null;
  personalCode: string | null;
  contactNumber: string | null;
}

interface SuggestedGroup {
  id: string;
  name: string;
  mode: "last" | "second" | "frequent";
  travellers: TravellerInfo[];
}

// GET: Get suggested travellers based on client's travel history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partyId: string }> }
) {
  try {
    const { partyId } = await params;
    
    const auth = await getUserAndCompany(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get orders where this party is the main client, ordered by date
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, order_code, created_at")
      .eq("client_party_id", partyId)
      .eq("company_id", auth.companyId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ suggestedGroups: [] });
    }

    const suggestedGroups: SuggestedGroup[] = [];
    const companyId = auth.companyId;

    // Helper function to get travellers for an order
    async function getTravellersForOrder(orderId: string): Promise<TravellerInfo[]> {
      const { data: travellers } = await supabaseAdmin
        .from("order_travellers")
        .select(`
          party_id,
          party:party_id (
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
        .eq("order_id", orderId)
        .eq("company_id", companyId)
        .neq("party_id", partyId); // Exclude main client

      return (travellers || []).map((t) => {
        // Handle both single object and array return from Supabase join
        const partyRaw = t.party as unknown;
        const party = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw as { id: string; display_name: string; phone: string; party_person: { first_name: string; last_name: string; title: string; dob: string; personal_code: string }[] } | null;
        const person = party?.party_person?.[0];
        
        return {
          id: t.party_id,
          firstName: person?.first_name || party?.display_name?.split(" ")[0] || "",
          lastName: person?.last_name || party?.display_name?.split(" ").slice(1).join(" ") || "",
          title: person?.title || "Mr",
          dob: person?.dob || null,
          personalCode: person?.personal_code || null,
          contactNumber: party?.phone || null,
        };
      });
    }

    // Last trip party
    if (orders.length >= 1) {
      const lastTripTravellers = await getTravellersForOrder(orders[0].id);
      if (lastTripTravellers.length > 0) {
        suggestedGroups.push({
          id: "last-trip",
          name: "Last trip party",
          mode: "last",
          travellers: lastTripTravellers,
        });
      }
    }

    // Second last trip party
    if (orders.length >= 2) {
      const secondLastTravellers = await getTravellersForOrder(orders[1].id);
      if (secondLastTravellers.length > 0) {
        suggestedGroups.push({
          id: "second-last",
          name: "Second last party",
          mode: "second",
          travellers: secondLastTravellers,
        });
      }
    }

    // Most frequent travellers (across all orders with this client)
    const orderIds = orders.map(o => o.id);
    const { data: allTravellers } = await supabaseAdmin
      .from("order_travellers")
      .select(`
        party_id,
        party:party_id (
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
      .in("order_id", orderIds)
      .eq("company_id", companyId)
      .neq("party_id", partyId);

    if (allTravellers && allTravellers.length > 0) {
      // Count frequency of each traveller
      const frequencyMap = new Map<string, { count: number; traveller: TravellerInfo }>();
      
      allTravellers.forEach((t) => {
        // Handle both single object and array return from Supabase join
        const partyRaw = t.party as unknown;
        const party = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw as { id: string; display_name: string; phone: string; party_person: { first_name: string; last_name: string; title: string; dob: string; personal_code: string }[] } | null;
        const person = party?.party_person?.[0];
        
        const existing = frequencyMap.get(t.party_id);
        if (existing) {
          existing.count++;
        } else {
          frequencyMap.set(t.party_id, {
            count: 1,
            traveller: {
              id: t.party_id,
              firstName: person?.first_name || party?.display_name?.split(" ")[0] || "",
              lastName: person?.last_name || party?.display_name?.split(" ").slice(1).join(" ") || "",
              title: person?.title || "Mr",
              dob: person?.dob || null,
              personalCode: person?.personal_code || null,
              contactNumber: party?.phone || null,
            }
          });
        }
      });

      // Sort by frequency and take top 5
      const sortedByFrequency = Array.from(frequencyMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(item => item.traveller);

      if (sortedByFrequency.length > 0) {
        suggestedGroups.push({
          id: "most-frequent",
          name: "Most frequent party",
          mode: "frequent",
          travellers: sortedByFrequency,
        });
      }
    }

    return NextResponse.json({ suggestedGroups });
  } catch (error) {
    console.error("Suggested travellers GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
