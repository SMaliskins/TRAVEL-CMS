import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { fetchOrderRowByRouteParam } from "@/lib/orders/orderFromRouteParam";

async function getOrderAndVerify(orderCodeParam: string, companyId: string | null) {
  if (!companyId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const found = await fetchOrderRowByRouteParam(supabaseAdmin, companyId, orderCodeParam);
  if (!found) {
    return { error: NextResponse.json({ error: "Order not found" }, { status: 404 }) };
  }
  if (found.row.company_id !== companyId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { orderId: found.row.id as string, companyId: found.row.company_id as string };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; docId: string }> }
) {
  try {
    const { orderCode, docId } = await params;
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId, userId } = apiUser;

    const orderResult = await getOrderAndVerify(orderCode, companyId);
    if ("error" in orderResult) return orderResult.error;

    const body = await request.json().catch(() => ({}));
    const serviceIds = Array.isArray(body.serviceIds)
      ? [...new Set(body.serviceIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0))]
      : [];

    const { data: doc, error: docError } = await supabaseAdmin
      .from("order_documents")
      .select("id, company_id, order_id, document_type, document_state")
      .eq("id", docId)
      .eq("company_id", orderResult.companyId)
      .eq("order_id", orderResult.orderId)
      .single();

    if (docError || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (doc.document_type !== "invoice") {
      return NextResponse.json({ error: "Only invoice documents can be matched to services" }, { status: 400 });
    }
    if (doc.document_state !== "active") {
      return NextResponse.json({ error: "Only active documents can be matched" }, { status: 400 });
    }

    if (serviceIds.length > 0) {
      const { data: services, error: servicesError } = await supabaseAdmin
        .from("order_services")
        .select("id")
        .eq("company_id", orderResult.companyId)
        .eq("order_id", orderResult.orderId)
        .in("id", serviceIds);

      if (servicesError) {
        console.error("[match-services] services fetch:", servicesError);
        return NextResponse.json({ error: "Failed to verify services" }, { status: 500 });
      }
      const validIds = new Set((services || []).map((service) => service.id));
      if (validIds.size !== serviceIds.length) {
        return NextResponse.json({ error: "One or more services do not belong to this order" }, { status: 400 });
      }
    }

    const { data: existingLinks, error: existingLinksError } = await supabaseAdmin
      .from("order_document_service_links")
      .select("service_id")
      .eq("company_id", orderResult.companyId)
      .eq("order_id", orderResult.orderId)
      .eq("document_id", docId);

    if (existingLinksError) {
      console.error("[match-services] fetch old links:", existingLinksError);
      return NextResponse.json({ error: "Failed to load existing matches" }, { status: 500 });
    }

    const existingServiceIds = new Set((existingLinks || []).map((link) => link.service_id).filter(Boolean));
    const requestedServiceIds = new Set(serviceIds);
    const serviceIdsToInsert = serviceIds.filter((serviceId) => !existingServiceIds.has(serviceId));
    const serviceIdsToDelete = [...existingServiceIds].filter((serviceId) => !requestedServiceIds.has(serviceId));

    if (serviceIdsToInsert.length > 0) {
      const rows = serviceIdsToInsert.map((serviceId) => ({
        company_id: orderResult.companyId,
        order_id: orderResult.orderId,
        document_id: docId,
        service_id: serviceId,
        created_by: userId,
      }));
      const { error: insertError } = await supabaseAdmin
        .from("order_document_service_links")
        .insert(rows);

      if (insertError) {
        console.error("[match-services] insert links:", insertError);
        return NextResponse.json({ error: "Failed to save matches" }, { status: 500 });
      }
    }

    if (serviceIdsToDelete.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("order_document_service_links")
        .delete()
        .eq("company_id", orderResult.companyId)
        .eq("order_id", orderResult.orderId)
        .eq("document_id", docId)
        .in("service_id", serviceIdsToDelete);

      if (deleteError) {
        console.error("[match-services] delete old links:", deleteError);
        return NextResponse.json({ error: "Failed to clear removed matches" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, matchedServiceIds: serviceIds });
  } catch (error) {
    console.error("[match-services] POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
