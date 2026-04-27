import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { getSupplierInvoiceAccountingUpdate } from "@/lib/finances/supplierInvoiceAccounting";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (apiUser.role !== "finance" && apiUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: only Finance role can process supplier invoices" }, { status: 403 });
    }

    const { data: doc, error: fetchError } = await supabaseAdmin
      .from("order_documents")
      .select("id, company_id, document_type, accounting_state, attention_reason")
      .eq("id", docId)
      .eq("company_id", apiUser.companyId)
      .maybeSingle();

    if (fetchError || !doc) return NextResponse.json({ error: "Supplier invoice not found" }, { status: 404 });
    if (doc.document_type !== "invoice") {
      return NextResponse.json({ error: "Only supplier invoice documents can be processed" }, { status: 400 });
    }

    let updatePayload;
    try {
      updatePayload = getSupplierInvoiceAccountingUpdate({
        currentState: doc.accounting_state,
        attentionReason: doc.attention_reason,
        processedAt: new Date().toISOString(),
        processedBy: apiUser.userId,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Supplier invoice cannot be processed" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("order_documents")
      .update(updatePayload)
      .eq("id", docId)
      .eq("company_id", apiUser.companyId);

    if (updateError) {
      console.error("[UploadedDocuments] process update:", updateError);
      return NextResponse.json({ error: "Failed to process supplier invoice" }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: { id: docId, ...updatePayload } });
  } catch (error) {
    console.error("[UploadedDocuments] PATCH process:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
