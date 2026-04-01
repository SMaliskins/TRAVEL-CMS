import { NextRequest, NextResponse } from "next/server";
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partyId: string }> }
) {
  try {
    const { partyId } = await params;

    const { data: party, error: partyErr } = await supabaseAdmin
      .from("party")
      .select("id, company_id, display_name, email, phone, country")
      .eq("id", partyId)
      .single();

    if (partyErr || !party?.company_id) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    const [personRes, companyRes] = await Promise.all([
      supabaseAdmin.from("party_person").select("*").eq("party_id", partyId).maybeSingle(),
      supabaseAdmin.from("party_company").select("*").eq("party_id", partyId).maybeSingle(),
    ]);

    const searchText = buildPartySearchText(party, personRes.data, companyRes.data);
    if (!searchText.trim()) {
      return NextResponse.json({ error: "No searchable text" }, { status: 400 });
    }

    const embedding = await generateEmbedding(searchText);

    const { error: upsertErr } = await supabaseAdmin
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

    if (upsertErr) {
      console.error("party_embeddings upsert error:", upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upsert failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
