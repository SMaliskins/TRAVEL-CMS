import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface SplitPart {
  amount: number;
  serviceAmount?: number;
  payerName: string;
  payerPartyId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; serviceId: string }> }
) {
  try {
    const { orderCode, serviceId } = await params;
    const body = await request.json();
    const { parts } = body as { parts: SplitPart[] };

    if (!parts || !Array.isArray(parts) || parts.length < 2) {
      return NextResponse.json(
        { error: "At least 2 parts required" },
        { status: 400 }
      );
    }

    const { data: originalService, error: fetchError } = await supabaseAdmin
      .from("order_services")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (fetchError || !originalService) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    const totalAmount = parts.reduce((sum, part) => sum + part.amount, 0);
    if (Math.abs(totalAmount - originalService.client_price) > 0.01) {
      return NextResponse.json(
        { error: "Total client amount must equal original service price" },
        { status: 400 }
      );
    }

    if (originalService.invoice_id) {
      return NextResponse.json(
        { error: "Cannot split service that already has an invoice" },
        { status: 400 }
      );
    }

    const newServices = parts.map((part) => {
      // Use provided serviceAmount or calculate proportionally
      let proportionalServicePrice;
      if (part.serviceAmount !== undefined) {
        proportionalServicePrice = part.serviceAmount;
      } else {
        const priceRatio = part.amount / originalService.client_price;
        proportionalServicePrice = originalService.service_price * priceRatio;
      }

      return {
        order_id: originalService.order_id,
        company_id: originalService.company_id,
        category: originalService.category,
        name: originalService.name,
        service_date_from: originalService.service_date_from,
        service_date_to: originalService.service_date_to,
        service_provider: originalService.service_provider,
        ref_nr: originalService.ref_nr,
        ticket_nr: originalService.ticket_nr,
        client_price: part.amount,
        service_price: proportionalServicePrice,
        reservation_status: originalService.reservation_status,
        payer_party_id: part.payerPartyId || originalService.payer_party_id,
        client_party_id: originalService.client_party_id,
        notes: originalService.notes
          ? `${originalService.notes}\n[Split from original service - Payer: ${part.payerName}]`
          : `[Split from original service - Payer: ${part.payerName}]`,
      };
    });

    const { data: createdServices, error: insertError } = await supabaseAdmin
      .from("order_services")
      .insert(newServices)
      .select();

    if (insertError) {
      console.error("Error creating split services:", insertError);
      return NextResponse.json(
        { error: "Failed to create split services", details: insertError.message },
        { status: 500 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("order_services")
      .delete()
      .eq("id", serviceId);

    if (deleteError) {
      console.error("Error deleting original service:", deleteError);
      return NextResponse.json({
        success: true,
        createdServices,
        warning: "Original service could not be deleted",
      });
    }

    return NextResponse.json({
      success: true,
      createdServices,
      message: `Service split into ${parts.length} parts`,
    });
  } catch (error: any) {
    console.error("Split service error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
