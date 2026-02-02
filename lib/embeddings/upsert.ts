import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateEmbedding } from "@/lib/embeddings";

function buildPartySearchText(party: any, person: any, company: any): string {
  const parts: string[] = [];
  if (party?.display_name) parts.push(party.display_name);
  if (person?.first_name) parts.push(person.first_name);
  if (person?.last_name) parts.push(person.last_name);
  if (person?.personal_code) parts.push(person.personal_code);
  if (person?.email) parts.push(person.email);
  if (company?.company_name) parts.push(company.company_name);
  if (company?.reg_number) parts.push(company.reg_number);
  if (party?.email) parts.push(party.email);
  if (party?.phone) parts.push(party.phone);
  if (party?.country) parts.push(party.country);
  return parts.filter(Boolean).join(" ");
}

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

export async function upsertPartyEmbedding(partyId: string): Promise<void> {
  try {
    const { data: party, error: partyErr } = await supabaseAdmin
      .from("party")
      .select("id, company_id, display_name, email, phone, country")
      .eq("id", partyId)
      .single();

    if (partyErr || !party?.company_id) return;

    const [personRes, companyRes] = await Promise.all([
      supabaseAdmin.from("party_person").select("*").eq("party_id", partyId).maybeSingle(),
      supabaseAdmin.from("party_company").select("*").eq("party_id", partyId).maybeSingle(),
    ]);

    const searchText = buildPartySearchText(party, personRes.data, companyRes.data);
    if (!searchText.trim()) return;

    const embedding = await generateEmbedding(searchText);

    await supabaseAdmin
      .from("party_embeddings")
      .upsert(
        {
          party_id: partyId,
          company_id: party.company_id,
          search_text: searchText,
          embedding,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "party_id" }
      );
  } catch (e) {
    console.error("[upsertPartyEmbedding]", partyId, e);
  }
}

export async function upsertOrderServiceEmbedding(serviceId: string): Promise<void> {
  try {
    const { data: service, error: svcErr } = await supabaseAdmin
      .from("order_services")
      .select("id, order_id, company_id, service_name, category, supplier_name, client_name, payer_name, ref_nr, ticket_nr, hotel_name, hotel_address, notes, flight_segments")
      .eq("id", serviceId)
      .single();

    if (svcErr || !service?.company_id) return;

    const searchText = buildServiceSearchText(service);
    if (!searchText.trim()) return;

    const embedding = await generateEmbedding(searchText);

    await supabaseAdmin
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
  } catch (e) {
    console.error("[upsertOrderServiceEmbedding]", serviceId, e);
  }
}
