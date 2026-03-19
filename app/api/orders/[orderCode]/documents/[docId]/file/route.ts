import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

const BUCKET_NAME = "order-documents";

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
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId } = apiUser;

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
