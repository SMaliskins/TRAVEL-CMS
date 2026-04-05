import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getApiUser } from "@/lib/auth/getApiUser";
import {
  buildExpandedOrderAndInvoiceSummary,
  loadFormattedTravellersForOrder,
} from "@/lib/orders/orderPageBootstrap";
import { fetchOrderRowByRouteParam } from "@/lib/orders/orderFromRouteParam";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

/** ORDER_PAGE_PERF Step 3: order header + travellers + invoice summary in one round-trip (parallel server work). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;
    const { orderCode: orderCodeParam } = await params;

    const found = await fetchOrderRowByRouteParam(supabaseAdmin, companyId, orderCodeParam);
    if (!found) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderRecord = found.row as unknown as Record<string, unknown>;
    const canonicalCode = found.order_code;

    const [expanded, travellers] = await Promise.all([
      buildExpandedOrderAndInvoiceSummary(supabaseAdmin, orderRecord, companyId, apiUser),
      loadFormattedTravellersForOrder(supabaseAdmin, companyId, canonicalCode, {
        id: orderRecord.id as string,
        client_party_id: (orderRecord.client_party_id as string | null | undefined) ?? null,
      }),
    ]);

    return NextResponse.json({
      order: expanded.order,
      travellers,
      invoiceSummary: expanded.invoiceSummary,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Order bootstrap error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
