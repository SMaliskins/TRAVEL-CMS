import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { fetchOrderRowByRouteParam } from "@/lib/orders/orderFromRouteParam";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode: rawCode } = await params;

    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const found = await fetchOrderRowByRouteParam(supabaseAdmin, apiUser.companyId, rawCode);
    if (!found) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const order = { id: found.row.id as string, company_id: apiUser.companyId };

    const { searchParams } = new URL(request.url);
    const invoiceIdsRaw = searchParams.get("invoiceIds");
    const invoiceIds = invoiceIdsRaw
      ? invoiceIdsRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => UUID_RE.test(s))
          .slice(0, 200)
      : [];

    const limitRaw = searchParams.get("limit");
    const limit =
      limitRaw === null || limitRaw === ""
        ? null
        : Math.min(500, Math.max(1, parseInt(limitRaw, 10) || 40));
    const offset =
      limit !== null ? Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0) : 0;

    const selectCols = `
        id,
        type,
        recipient_email,
        subject,
        body,
        sent_at,
        sent_by,
        email_sent,
        delivery_status,
        delivered_at,
        opened_at,
        open_count,
        invoice_id,
        service_id,
        resend_email_id,
        email_kind
      `;

    let q = supabaseAdmin
      .from("order_communications")
      .select(selectCols, limit !== null ? { count: "exact" } : undefined)
      .eq("order_id", order.id)
      .order("sent_at", { ascending: false });

    if (invoiceIds.length > 0) {
      q = q.in("invoice_id", invoiceIds);
    }

    if (limit !== null) {
      q = q.range(offset, offset + limit - 1);
    }

    const { data: communications, error, count } = await q;

    if (error) {
      console.error("Error fetching communications:", error);
      return NextResponse.json({ error: "Failed to fetch communications" }, { status: 500 });
    }

    const senderIds = [...new Set((communications || []).map((c) => c.sent_by).filter(Boolean))];
    let senderMap: Record<string, string> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id, first_name, last_name")
        .in("id", senderIds);
      if (profiles) {
        senderMap = Object.fromEntries(
          profiles.map((p) => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim()])
        );
      }
    }

    const enriched = (communications || []).map((c) => ({
      ...c,
      sender_name: c.sent_by ? senderMap[c.sent_by] || "Unknown" : null,
    }));

    const payload: {
      communications: typeof enriched;
      pagination?: { offset: number; limit: number; total: number };
    } = { communications: enriched };

    if (limit !== null) {
      payload.pagination = {
        offset,
        limit,
        total: typeof count === "number" ? count : enriched.length,
      };
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Communications GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
