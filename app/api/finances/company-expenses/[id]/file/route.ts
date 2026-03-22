import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET_NAME = "company-expense-invoices";

/**
 * GET /api/finances/company-expenses/[id]/file
 * Streams the stored invoice PDF/image so it can be viewed or downloaded.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("company_expense_invoices")
      .select("id, company_id, file_path, file_name, mime_type")
      .eq("id", id)
      .single();

    if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.company_id !== apiUser.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!row.file_path) return NextResponse.json({ error: "No file attached" }, { status: 404 });

    const { data: blob, error: downloadErr } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(row.file_path);

    if (downloadErr || !blob) {
      console.error("[company-expenses] file download error:", downloadErr);
      return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
    }

    const ext = (row.file_name || "").split(".").pop()?.toLowerCase();
    const mime =
      row.mime_type ||
      (ext === "pdf"
        ? "application/pdf"
        : ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "webp"
              ? "image/webp"
              : "application/pdf");
    const fileName = row.file_name || "invoice.pdf";
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("[company-expenses] GET file:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
