import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrdersColumns, resolveOrderInsertPayload } from "@/lib/orders/resolveOrderColumns";

// Placeholder URLs for build-time (replaced at runtime)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

// Create Supabase admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

interface CreateOrderRequest {
  clientPartyId: string;
  orderType: "TA" | "TO" | "CORP" | "NON";
  ownerAgent: string;
  ownerName?: string;
  cities: string[]; // Array of city names
  countries: string[]; // Array of unique country names
  checkIn: string | null; // ISO date string
  return: string | null; // ISO date string
  status?: string;
}

// Generate order code: 0001/25-SM
async function generateOrderCode(ownerAgent: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const yearSuffix = currentYear.toString().slice(-2);

  try {
    // Try to use order_counters table if it exists
    const { data: counterData, error: counterError } = await supabaseAdmin
      .from("order_counters")
      .select("seq")
      .eq("year", currentYear)
      .single();

    let nextSeq: number;

    if (counterError && counterError.code === "PGRST116") {
      // Row doesn't exist, create it
      nextSeq = 1;
      const { error: insertError } = await supabaseAdmin
        .from("order_counters")
        .insert({ year: currentYear, seq: 1 });
      
      if (insertError) {
        return await generateOrderCodeFallback(ownerAgent, yearSuffix);
      }
    } else if (counterError) {
      return await generateOrderCodeFallback(ownerAgent, yearSuffix);
    } else {
      // Increment counter
      nextSeq = (counterData?.seq || 0) + 1;
      const { error: updateError } = await supabaseAdmin
        .from("order_counters")
        .update({ seq: nextSeq })
        .eq("year", currentYear);

      if (updateError) {
        return await generateOrderCodeFallback(ownerAgent, yearSuffix);
      }
    }

    const seqStr = nextSeq.toString().padStart(4, "0");
    const agentSuffix = ownerAgent.trim().toUpperCase().slice(0, 10) || "XX";
    return `${seqStr}/${yearSuffix}-${agentSuffix}`;
  } catch (error) {
    return await generateOrderCodeFallback(ownerAgent, yearSuffix);
  }
}

// Fallback: query orders table for max sequence
async function generateOrderCodeFallback(ownerAgent: string, yearSuffix: string): Promise<string> {
  try {
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("order_number");

    if (error) {
      const timestamp = Date.now().toString().slice(-4);
      return `${timestamp}/${yearSuffix}-${ownerAgent.trim().toUpperCase().slice(0, 10) || "XX"}`;
    }

    let maxSeq = 0;
    const pattern = new RegExp(`^(\\d+)/${yearSuffix}-`);
    
    orders?.forEach((order) => {
      const match = order.order_number?.match(pattern);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    });

    const nextSeq = maxSeq + 1;
    const seqStr = nextSeq.toString().padStart(4, "0");
    const agentSuffix = ownerAgent.trim().toUpperCase().slice(0, 10) || "XX";
    return `${seqStr}/${yearSuffix}-${agentSuffix}`;
  } catch (error) {
    const timestamp = Date.now().toString().slice(-4);
    return `${timestamp}/${yearSuffix}-${ownerAgent.trim().toUpperCase().slice(0, 10) || "XX"}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if service role key is set
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error", details: "SUPABASE_SERVICE_ROLE_KEY is not set" },
        { status: 500 }
      );
    }

    // Get authenticated user from Authorization header or cookies
    let user = null;
    
    // Try to get user from Authorization header first (preferred)
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await authClient.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    // If no user from Authorization header, try cookies
    if (!user) {
      const cookieHeader = request.headers.get("cookie") || "";
      if (cookieHeader) {
        // Create client with cookies
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
          },
          global: {
            headers: {
              Cookie: cookieHeader,
            },
          },
        });
        
        // Try to get user from session
        const { data, error } = await authClient.auth.getUser();
        if (!error && data?.user) {
          user = data.user;
        }
      }
    }

    // If still no user, return 401
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: cannot get user" },
        { status: 401 }
      );
    }

    const body: CreateOrderRequest = await request.json();

    // Validate required fields
    if (!body.clientPartyId) {
      return NextResponse.json(
        { error: "clientPartyId is required" },
        { status: 400 }
      );
    }

    if (!body.orderType) {
      return NextResponse.json(
        { error: "orderType is required" },
        { status: 400 }
      );
    }

    // Generate order code
    const orderCode = await generateOrderCode(body.ownerAgent || "XX");

    // Get available columns (try to fetch, but proceed even if we can't)
    const columnsSet = await getOrdersColumns();

    // Resolve payload using column resolver
    const { payload, errors } = resolveOrderInsertPayload(
      {
        client_party_id: body.clientPartyId,
        order_type: body.orderType,
        status: body.status || "Active",
        owner_initials: body.ownerAgent,
        owner_name: body.ownerName,
        cities: body.cities,
        countries: body.countries,
        check_in_date: body.checkIn || null,
        return_date: body.return || null,
      },
      columnsSet
    );

    // Check for required column errors
    if (errors.length > 0) {
      return NextResponse.json(
        { 
          error: errors.join("; ")
        },
        { status: 500 }
      );
    }

    payload.order_number = orderCode;
    
    // Add manager_user_id (required field)
    payload.manager_user_id = user.id;

    // Insert order using admin client to bypass RLS
    const { data: insertedOrder, error: insertError } = await supabaseAdmin
      .from("orders")
      .insert(payload)
      .select("id, order_number")
      .single();

    if (insertError) {
      // Check if error is about missing column
      const isColumnError = 
        insertError.code === "42703" || 
        insertError.message?.includes("column") ||
        insertError.message?.includes("Could not find");

      if (isColumnError) {
        // Extract column name from error
        const columnMatch = insertError.message?.match(/column[^"]*"([^"]+)"/i) || 
                          insertError.message?.match(/'([^']+)'/i) ||
                          insertError.message?.match(/Could not find the '([^']+)'/i);
        const columnName = columnMatch ? columnMatch[1] : "unknown";
        
        // If it's order_number or required column, return error
        if (columnName === "order_number" || 
            columnName === "client_party_id" || 
            columnName.toLowerCase() === "order_type" ||
            columnName.toLowerCase() === "type") {
          return NextResponse.json(
            { 
              error: `Orders schema missing required column: ${columnName}`
            },
            { status: 500 }
          );
        }
        
        // For any other column error, it means our resolver included a column that doesn't exist
        // This shouldn't happen if columnsSet was populated correctly, but handle gracefully
        // Never remove manager_user_id - it's required
        if (columnName !== "manager_user_id") {
          delete payload[columnName];
        }
        
        // Ensure manager_user_id is still in payload before retry
        payload.manager_user_id = user.id;
        
        // Retry insert without the problematic column
        const { data: retryOrder, error: retryError } = await supabaseAdmin
          .from("orders")
          .insert(payload)
          .select("id, order_number")
          .single();

        if (retryError) {
          return NextResponse.json(
            { error: `Failed to create order: ${retryError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          order_id: retryOrder.id,
          order_number: retryOrder.order_number,
        });
      }

      return NextResponse.json(
        { error: `Failed to create order: ${insertError.message}` },
        { status: 500 }
      );
    }

    if (!insertedOrder) {
      return NextResponse.json(
        { error: "Order was created but no data was returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      order_id: insertedOrder.id,
      order_number: insertedOrder.order_number,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
