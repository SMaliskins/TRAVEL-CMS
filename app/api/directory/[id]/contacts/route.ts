import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { normalizeForSearch } from "@/lib/directory/searchNormalize";

const CYR_TO_LAT: Record<string, string> = {
  "й": "q", "ц": "w", "у": "e", "к": "r", "е": "t", "н": "y", "г": "u", "ш": "i", "щ": "o", "з": "p",
  "ф": "a", "ы": "s", "в": "d", "а": "f", "п": "g", "р": "h", "о": "j", "л": "k", "д": "l",
  "я": "z", "ч": "x", "с": "c", "м": "v", "и": "b", "т": "n", "ь": "m",
};

function cyrToLatKeyboard(s: string): string {
  let out = "";
  for (const c of s) out += CYR_TO_LAT[c.toLowerCase()] ?? c;
  return out;
}

function normalizeText(s: string): string {
  // Normalize look-alike Cyrillic letters that visually match Latin.
  const lookalikeMap: Record<string, string> = {
    "а": "a",
    "е": "e",
    "о": "o",
    "р": "p",
    "с": "c",
    "у": "y",
    "х": "x",
    "і": "i",
    "к": "k",
    "м": "m",
    "т": "t",
    "в": "b",
    "н": "h",
  };
  const unified = Array.from(s || "")
    .map((ch) => lookalikeMap[ch.toLowerCase()] ?? ch)
    .join("");

  return normalizeForSearch(unified)
    .replace(/[^a-z0-9а-яё\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isEditDistanceLeqOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;

    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyPartyId } = await params;
  const { searchParams } = new URL(request.url);
  const searchQuery = searchParams.get("search");

  // Search by surname within current company (deterministic, typo-tolerant).
  if (searchQuery && searchQuery.length >= 2) {
    const raw = searchQuery.replace(/[%_,]/g, "").trim();
    const keyboardLatin = cyrToLatKeyboard(raw);
    const q = normalizeText(raw);
    const qAlt = normalizeText(keyboardLatin);
    const prefix = raw.slice(0, 3);
    const altPrefix = keyboardLatin.slice(0, 3);

    // Candidate rows from current company only (no full-table scan).
    const { data: partyRows, error: partyError } = await supabaseAdmin
      .from("party")
      .select("id, display_name, email, phone")
      .eq("party_type", "person")
      .eq("company_id", user.companyId)
      .eq("status", "active")
      .or([
        `display_name.ilike.%${raw}%`,
        `display_name.ilike.%${keyboardLatin}%`,
        `display_name.ilike.%${prefix}%`,
        `display_name.ilike.%${altPrefix}%`,
      ].join(","))
      .limit(400);

    if (partyError) {
      console.error("[CompanyContacts search]", partyError);
      return NextResponse.json({ error: partyError.message }, { status: 500 });
    }

    if (!partyRows || partyRows.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const partyIds = partyRows.map((r) => r.id);
    const { data: personRows, error: personError } = await supabaseAdmin
      .from("party_person")
      .select("party_id, first_name, last_name")
      .in("party_id", partyIds)
      .limit(400);
    if (personError) {
      console.error("[CompanyContacts search personRows]", personError);
      return NextResponse.json({ error: personError.message }, { status: 500 });
    }
    const personMap = new Map(
      (personRows || []).map((p: { party_id: string; first_name?: string | null; last_name?: string | null }) => [
        p.party_id,
        {
          firstName: (p.first_name || "").trim(),
          lastName: (p.last_name || "").trim(),
        },
      ])
    );

    const ranked = partyRows.map((row) => {
      const person = personMap.get(row.id);
      const firstName = person?.firstName || "";
      const lastName = person?.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim() || (row.display_name || "").trim();

      const inferredLast = fullName.split(/\s+/).filter(Boolean).slice(-1)[0] || "";
      const surname = lastName || inferredLast;
      const lastNorm = normalizeText(surname);
      const fullNorm = normalizeText(fullName);
      const qForFuzzy = q || qAlt;
      const lastPrefix = qForFuzzy ? lastNorm.slice(0, qForFuzzy.length) : "";
      const oneLetterMiss =
        !!qForFuzzy &&
        qForFuzzy.length >= 4 &&
        !!lastPrefix &&
        isEditDistanceLeqOne(qForFuzzy, lastPrefix);

      let score = 99;
      if ((q && lastNorm.startsWith(q)) || (qAlt && lastNorm.startsWith(qAlt))) score = 0;
      else if ((q && lastNorm.includes(q)) || (qAlt && lastNorm.includes(qAlt))) score = 1;
      else if (oneLetterMiss) score = 2;
      else if ((q && fullNorm.startsWith(q)) || (qAlt && fullNorm.startsWith(qAlt))) score = 3;
      else if ((q && fullNorm.includes(q)) || (qAlt && fullNorm.includes(qAlt))) score = 4;

      return {
        id: row.id,
        displayName: fullName,
        email: row.email || "",
        phone: row.phone || "",
        score,
      };
    });

    const finalResults = ranked
      .filter((r) => r.score < 99 && r.displayName)
      .sort((a, b) => a.score - b.score || a.displayName.localeCompare(b.displayName))
      .slice(0, 10)
      .map(({ id, displayName, email, phone }) => ({ id, displayName, email, phone }));

    return NextResponse.json({ results: finalResults });
  }

  const { data, error } = await supabaseAdmin
    .from("company_contacts")
    .select(`
      id,
      role,
      is_primary,
      contact_party_id,
      created_at,
      contact:party!contact_party_id (
        id,
        display_name,
        email,
        phone
      )
    `)
    .eq("company_party_id", companyPartyId)
    .order("role")
    .order("is_primary", { ascending: false });

  if (error) {
    console.error("[CompanyContacts GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contacts = (data || []).map((row: Record<string, unknown>) => {
    const contact = row.contact as Record<string, unknown> | null;
    return {
      id: row.id,
      contactPartyId: row.contact_party_id,
      role: row.role,
      isPrimary: row.is_primary,
      displayName: contact?.display_name || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
    };
  });

  return NextResponse.json({ contacts });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyPartyId } = await params;
  const body = await request.json();
  const { contactPartyId, role, isPrimary } = body;

  if (!contactPartyId || !role) {
    return NextResponse.json(
      { error: "contactPartyId and role are required" },
      { status: 400 }
    );
  }

  if (!["financial", "administrative"].includes(role)) {
    return NextResponse.json(
      { error: "role must be 'financial' or 'administrative'" },
      { status: 400 }
    );
  }

  const { data: companyParty } = await supabaseAdmin
    .from("party")
    .select("party_type")
    .eq("id", companyPartyId)
    .single();

  if (!companyParty || companyParty.party_type !== "company") {
    return NextResponse.json(
      { error: "Target party must be a company" },
      { status: 400 }
    );
  }

  const { data: contactParty } = await supabaseAdmin
    .from("party")
    .select("party_type")
    .eq("id", contactPartyId)
    .single();

  if (!contactParty || contactParty.party_type !== "person") {
    return NextResponse.json(
      { error: "Contact must be a person" },
      { status: 400 }
    );
  }

  if (isPrimary) {
    await supabaseAdmin
      .from("company_contacts")
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq("company_party_id", companyPartyId)
      .eq("role", role);
  }

  const { data, error } = await supabaseAdmin
    .from("company_contacts")
    .insert({
      company_party_id: companyPartyId,
      contact_party_id: contactPartyId,
      role,
      is_primary: isPrimary ?? false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This contact is already linked with this role" },
        { status: 409 }
      );
    }
    console.error("[CompanyContacts POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyPartyId } = await params;
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId");

  if (!contactId) {
    return NextResponse.json(
      { error: "contactId query parameter is required" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("company_contacts")
    .delete()
    .eq("id", contactId)
    .eq("company_party_id", companyPartyId);

  if (error) {
    console.error("[CompanyContacts DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyPartyId } = await params;
  const body = await request.json();
  const { contactId, isPrimary } = body;

  if (!contactId) {
    return NextResponse.json(
      { error: "contactId is required" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("company_contacts")
    .select("role")
    .eq("id", contactId)
    .eq("company_party_id", companyPartyId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  if (isPrimary) {
    await supabaseAdmin
      .from("company_contacts")
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq("company_party_id", companyPartyId)
      .eq("role", existing.role);
  }

  const { error } = await supabaseAdmin
    .from("company_contacts")
    .update({
      is_primary: isPrimary ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId)
    .eq("company_party_id", companyPartyId);

  if (error) {
    console.error("[CompanyContacts PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
