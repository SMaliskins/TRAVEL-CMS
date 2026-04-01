import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const BUCKET_NAME = "order-documents";

async function getCompanyId(userId: string): Promise<string | null> {
  const { data: p } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
  if (p?.company_id) return p.company_id as string;
  const { data: up } = await supabaseAdmin.from("user_profiles").select("company_id").eq("id", userId).maybeSingle();
  return (up?.company_id as string) ?? null;
}

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user } } = await client.auth.getUser(authHeader.replace("Bearer ", ""));
    return user;
  }
  const cookie = request.headers.get("cookie") || "";
  if (cookie) {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: cookie } },
    });
    const { data: { user } } = await client.auth.getUser();
    return user;
  }
  return null;
}

/**
 * GET /api/orders/[orderCode]/documents/[docId]/file
 * Streams the document file so it can be embedded in an iframe (same-origin).
 * Chrome blocks iframes loading Supabase signed URLs (X-Frame-Options); this proxy fixes that.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const companyId = await getCompanyId(user.id);
    if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 400 });

    const { data: doc, error: fetchErr } = await supabaseAdmin
      .from("order_documents")
      .select("id, company_id, file_path, file_name, mime_type")
      .eq("id", docId)
      .single();

    if (fetchErr || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (doc.company_id !== companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: blob, error: downloadErr } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(doc.file_path);

    if (downloadErr || !blob) {
      console.error("[Documents] file download error:", downloadErr);
      return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
    }

    const mime = doc.mime_type || "application/octet-stream";
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.file_name || "document")}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("[Documents] GET file:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
