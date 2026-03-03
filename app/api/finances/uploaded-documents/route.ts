import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET_NAME = "order-documents";

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  }
  const cookie = request.headers.get("cookie") || "";
  if (cookie) {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      { auth: { persistSession: false }, global: { headers: { Cookie: cookie } } }
    );
    const { data: { user } } = await client.auth.getUser();
    return user;
  }
  return null;
}

async function getCompanyId(userId: string): Promise<string | null> {
  const { data: p } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
  if (p?.company_id) return p.company_id as string;
  const { data: up } = await supabaseAdmin.from("user_profiles").select("company_id").eq("id", userId).maybeSingle();
  return (up?.company_id as string) ?? null;
}

// GET /api/finances/uploaded-documents - List uploaded invoices for company (for Finance role)
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const companyId = await getCompanyId(user.id);
    if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 404 });

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
        orders(order_code)
      `)
      .eq("company_id", companyId)
      .eq("document_type", "invoice")
      .order("created_at", { ascending: false });

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
