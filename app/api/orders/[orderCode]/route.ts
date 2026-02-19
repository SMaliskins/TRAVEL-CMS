import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToClient } from "@/lib/client-push/sendPush";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function getCompanyId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  return data?.company_id || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Get authenticated user
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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "User has no company assigned" }, { status: 400 });
    }

    // Fetch order by order_code
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("company_id", companyId)
      .eq("order_code", orderCode)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Sum of active (non-cancelled) services → amount_total for header
    const { data: services } = await supabaseAdmin
      .from("order_services")
      .select("res_status, client_price")
      .eq("order_id", order.id)
      .eq("company_id", companyId);

    const activeServices = (services || []).filter((s: { res_status?: string }) => s.res_status !== "cancelled");
    const amountTotalFromServices = activeServices.reduce(
      (sum: number, s: { client_price?: string | number }) => sum + (Number(s.client_price) || 0),
      0
    );
    const amountPaid = Number(order.amount_paid) || 0;
    const amountDebt = Math.max(0, amountTotalFromServices - amountPaid);

    // Payment dates and overdue from invoices (non-cancelled)
    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("deposit_date, final_payment_date, status")
      .eq("order_id", order.id)
      .eq("company_id", companyId)
      .neq("status", "cancelled");

    const paymentDates: { type: string; date: string }[] = [];
    let overdueDays: number | null = null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    (invoices || []).forEach((inv: { deposit_date?: string | null; final_payment_date?: string | null }) => {
      if (inv.deposit_date) paymentDates.push({ type: "deposit", date: inv.deposit_date });
      if (inv.final_payment_date) paymentDates.push({ type: "final", date: inv.final_payment_date });
    });

    paymentDates.forEach(({ date: dateStr }) => {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      if (d < today) {
        const days = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
        if (overdueDays === null || days > overdueDays) overdueDays = days;
      }
    });

    // Get owner name from user_profiles or profiles if owner_user_id exists
    let ownerName = null;
    if (order.owner_user_id) {
      // Try user_profiles first (id = auth.users.id)
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("id", order.owner_user_id)
        .single();
      
      if (profile) {
        ownerName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null;
      }
      
      // Fallback to profiles table
      if (!ownerName) {
        const { data: oldProfile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, initials")
          .eq("user_id", order.owner_user_id)
          .single();
        
        if (oldProfile) {
          ownerName = oldProfile.display_name || null;
        }
      }
    }
    
    // Fallback: try manager_user_id if owner_user_id not set
    if (!ownerName && order.manager_user_id) {
      const { data: managerProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("id", order.manager_user_id)
        .single();
      
      if (managerProfile) {
        ownerName = [managerProfile.first_name, managerProfile.last_name].filter(Boolean).join(" ") || null;
      }
    }
    
    // Fallback: try created_by if still no owner
    if (!ownerName && order.created_by) {
      const { data: creatorProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("id", order.created_by)
        .single();
      
      if (creatorProfile) {
        ownerName = [creatorProfile.first_name, creatorProfile.last_name].filter(Boolean).join(" ") || null;
      }
      
      // Also try profiles table for created_by
      if (!ownerName) {
        const { data: creatorOldProfile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, initials")
          .eq("user_id", order.created_by)
          .single();
        
        if (creatorOldProfile) {
          ownerName = creatorOldProfile.display_name || null;
        }
      }
    }
    
    // Last fallback: try to get name from auth.users metadata
    if (!ownerName && order.created_by) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(order.created_by);
      if (authUser?.user) {
        const meta = authUser.user.user_metadata;
        ownerName = meta?.full_name || meta?.name || 
                    [meta?.first_name, meta?.last_name].filter(Boolean).join(" ") ||
                    authUser.user.email?.split("@")[0] || null;
      }
    }
    
    // Ultimate fallback: use current user's name or email
    if (!ownerName && user) {
      const meta = user.user_metadata;
      ownerName = meta?.full_name || meta?.name || 
                  [meta?.first_name, meta?.last_name].filter(Boolean).join(" ") ||
                  user.email?.split("@")[0] || null;
    }

    return NextResponse.json({ 
      order: {
        ...order,
        owner_name: ownerName,
        amount_total: amountTotalFromServices,
        amount_paid: amountPaid,
        amount_debt: amountDebt,
        payment_dates: paymentDates,
        overdue_days: overdueDays,
      }
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Order GET error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;
    const body = await request.json();

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Get authenticated user
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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "User has no company assigned" }, { status: 400 });
    }

    // Build update payload - only allow certain fields
    const allowedFields = [
      "status", 
      "client_display_name",
      "client_party_id",
      "countries_cities", 
      "date_from", 
      "date_to",
      "order_type",
      "order_source"
    ];
    
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ["Draft", "Active", "Cancelled", "Completed", "On hold"];
      if (!validStatuses.includes(updateData.status as string)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
    }

    // Auto-sync client_display_name when client_party_id changes
    if (updateData.client_party_id && !updateData.client_display_name) {
      const { data: partyData } = await supabaseAdmin
        .from("party")
        .select("display_name")
        .eq("id", updateData.client_party_id)
        .single();
      
      if (partyData?.display_name) {
        updateData.client_display_name = partyData.display_name;
        console.log("[Order PATCH] Auto-synced client_display_name:", partyData.display_name);
      }
    }

    // Update order
    console.log("Updating order:", orderCode, "with data:", updateData);
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("company_id", companyId)
      .eq("order_code", orderCode)
      .select()
      .single();

    if (error) {
      console.error("Order update error:", error.message, error.details, error.hint);
      return NextResponse.json({ error: `Failed to update order: ${error.message}` }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const pushFields = ["status", "date_from", "date_to", "countries_cities"];
    const hasMeaningfulChange = pushFields.some((f) => body[f] !== undefined);

    if (hasMeaningfulChange && order.client_party_id) {
      const dest = order.countries_cities
        ? order.countries_cities.split("|").find((p: string) => !p.startsWith("origin:") && !p.startsWith("return:"))?.split(",")[1]?.trim() || "your trip"
        : "your trip";

      sendPushToClient(order.client_party_id, {
        title: "Trip updated",
        body: `Your trip to ${dest} has been updated`,
        type: "order_update",
        refId: order.id,
      }).catch((e: unknown) => console.error("[Push] fire-and-forget error:", e));
    }

    return NextResponse.json({ order });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Order PATCH error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
