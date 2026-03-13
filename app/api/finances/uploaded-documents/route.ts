import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

const BUCKET_NAME = "order-documents";

// GET /api/finances/uploaded-documents - List uploaded invoices for company
export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId, userId, scope } = apiUser;
    const isOwnScope = scope === "own";

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    let query = supabaseAdmin
      .from("order_documents")
      .select(`
        id,
        document_type,
        file_name,
        file_path,
        file_size,
        created_at,
        orders!inner(order_code, owner_user_id, manager_user_id)
      `)
      .eq("company_id", companyId)
      .eq("document_type", "invoice")
      .order("created_at", { ascending: false });

    if (isOwnScope) {
      query = query.or(`owner_user_id.eq.${userId},manager_user_id.eq.${userId}`, { referencedTable: "orders" });
    }

    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59.999Z");

    const { data: docs, error } = await query;

    if (error) {
      console.error("[UploadedDocuments] Error:", error);
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }

    const withUrls = await Promise.all(
      (docs || []).map(async (d: { file_path: string; orders?: { order_code?: string } | { order_code?: string }[] }) => {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .createSignedUrl(d.file_path, 60 * 60);
        const order = Array.isArray(d.orders) ? d.orders[0] : d.orders;
        const order_code = order?.order_code || null;
        return {
          ...d,
          order_code,
          orders: undefined,
          download_url: signed?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({ documents: withUrls });
  } catch (e) {
    console.error("[UploadedDocuments] GET:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
