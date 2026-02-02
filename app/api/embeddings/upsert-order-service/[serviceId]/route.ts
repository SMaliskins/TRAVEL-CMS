import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateEmbedding } from "@/lib/embeddings";

function buildServiceSearchText(service: any): string {
  const parts: string[] = [];
  if (service?.service_name) parts.push(service.service_name);
  if (service?.category) parts.push(service.category);
  if (service?.supplier_name) parts.push(service.supplier_name);
  if (service?.client_name) parts.push(service.client_name);
  if (service?.payer_name) parts.push(service.payer_name);
  if (service?.ref_nr) parts.push(service.ref_nr);
  if (service?.ticket_nr) parts.push(service.ticket_nr);
  if (service?.hotel_name) parts.push(service.hotel_name);
  if (service?.hotel_address) parts.push(service.hotel_address);
  if (service?.notes) parts.push(service.notes);
  const fs = service?.flight_segments;
  if (Array.isArray(fs)) {
    fs.forEach((s: any) => {
      if (s?.flightNumber) parts.push(s.flightNumber);
      if (s?.airline) parts.push(s.airline);
    });
  }
  return parts.filter(Boolean).join(" ");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;

    const { data: service, error: svcErr } = await supabaseAdmin
      .from("order_services")
      .select("id, order_id, company_id, service_name, category, supplier_name, client_name, payer_name, ref_nr, ticket_nr, hotel_name, hotel_address, notes, flight_segments")
      .eq("id", serviceId)
      .single();

    if (svcErr || !service?.company_id) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const searchText = buildServiceSearchText(service);
    if (!searchText.trim()) {
      return NextResponse.json({ error: "No searchable text" }, { status: 400 });
    }

    const embedding = await generateEmbedding(searchText);

    const { error: upsertErr } = await supabaseAdmin
      .from("order_service_embeddings")
      .upsert(
        {
          service_id: serviceId,
          order_id: service.order_id,
          company_id: service.company_id,
          search_text: searchText,
          embedding,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "service_id" }
      );

    if (upsertErr) {
      console.error("order_service_embeddings upsert error:", upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upsert failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
