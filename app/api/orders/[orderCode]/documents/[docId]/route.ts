import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import {
  getSupplierInvoiceDeleteUpdate,
  getSupplierInvoiceEditUpdate,
} from "@/lib/finances/supplierInvoiceAccounting";

const BUCKET_NAME = "order-documents";

// DELETE /api/orders/[orderCode]/documents/[docId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId, userId } = apiUser;

    const { data: doc, error: fetchErr } = await supabaseAdmin
      .from("order_documents")
      .select("id, company_id, file_path, accounting_state")
      .eq("id", docId)
      .single();

    if (fetchErr || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (doc.company_id !== companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const deleteUpdate = getSupplierInvoiceDeleteUpdate({
      currentState: doc.accounting_state,
      deletedAt: new Date().toISOString(),
      deletedBy: userId,
    });

    if (deleteUpdate.mode === "soft") {
      const { error: updateErr } = await supabaseAdmin
        .from("order_documents")
        .update(deleteUpdate.update)
        .eq("id", docId)
        .eq("company_id", companyId);

      if (updateErr) {
        console.error("[Documents] soft DELETE update error:", updateErr);
        return NextResponse.json({ error: "Failed to mark document as deleted" }, { status: 500 });
      }
      return NextResponse.json({ success: true, softDeleted: true });
    }

    await supabaseAdmin.storage.from(BUCKET_NAME).remove([doc.file_path]);
    const { error: delErr } = await supabaseAdmin.from("order_documents").delete().eq("id", docId);

    if (delErr) {
      console.error("[Documents] DELETE error:", delErr);
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Documents] DELETE:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/orders/[orderCode]/documents/[docId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId } = apiUser;

    const body = await request.json();
    const updateData: {
      amount?: number | null;
      currency?: string | null;
      invoice_number?: string | null;
      supplier_name?: string | null;
      invoice_date?: string | null;
      accounting_state?: string;
      attention_reason?: string | null;
      version?: number;
    } = {};

    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.invoice_number !== undefined) updateData.invoice_number = body.invoice_number;
    if (body.supplier_name !== undefined) updateData.supplier_name = body.supplier_name;
    if (body.invoice_date !== undefined) updateData.invoice_date = body.invoice_date;

    const { data: doc, error: fetchErr } = await supabaseAdmin
      .from("order_documents")
      .select("id, company_id, accounting_state, version")
      .eq("id", docId)
      .single();

    if (fetchErr || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (doc.company_id !== companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (Object.keys(updateData).length > 0) {
      const finalUpdateData = getSupplierInvoiceEditUpdate({
        currentState: doc.accounting_state,
        currentVersion: doc.version,
        changes: updateData,
      });
      const { error: updateErr } = await supabaseAdmin
        .from("order_documents")
        .update(finalUpdateData)
        .eq("id", docId);

      if (updateErr) {
        console.error("[Documents] PATCH update error:", updateErr);
        return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Documents] PATCH:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
