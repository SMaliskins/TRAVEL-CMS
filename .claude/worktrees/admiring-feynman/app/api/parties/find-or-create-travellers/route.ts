/**
 * POST /api/parties/find-or-create-travellers
 *
 * For each traveller:
 * - Search existing clients with diacritic-insensitive matching (garumzīmes, mīkstinājumzīmes ignored)
 * - If found: return existing party id and display_name
 * - If not found: create new client party, return new id and display_name
 *
 * Body: { names: string[] } OR { travellers: { name?: string; firstName?: string; lastName?: string }[] }
 * When travellers have explicit firstName/lastName (from AI parsing), use them directly.
 * Otherwise split name: if "Surname, FirstName" use comma split; else assume "FirstName Surname".
 *
 * Returns: { parties: { name: string; id: string; displayName: string }[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function normalizeForMatch(s: string): string {
  if (!s || typeof s !== "string") return "";
  const map: Record<string, string> = {
    ā: "a", Ā: "A", ē: "e", Ē: "E", ī: "i", Ī: "I", ū: "u", Ū: "U", ō: "o", Ō: "O",
    ķ: "k", Ķ: "K", ļ: "l", Ļ: "L", ņ: "n", Ņ: "N", ģ: "g", Ģ: "G",
    č: "c", Č: "C", š: "s", Š: "S", ž: "z", Ž: "Z",
    ą: "a", Ą: "A", ę: "e", Ę: "E", į: "i", Į: "I", ų: "u", Ų: "U", ń: "n", Ń: "N",
    ł: "l", Ł: "L", ś: "s", Ś: "S", ź: "z", Ź: "Z", ż: "z", Ż: "Z",
    ë: "e", ï: "i", ü: "u", ö: "o", ä: "a", ÿ: "y",
  };
  let out = "";
  for (const c of s.trim()) {
    out += map[c] ?? c;
  }
  return out.toLowerCase().replace(/\s+/g, " ").trim();
}

async function getAuthInfo(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;
  const userId = data.user.id;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  if (!profile?.company_id) return null;
  return { userId, companyId: profile.company_id };
}

export async function POST(request: NextRequest) {
  const authInfo = await getAuthInfo(request);
  if (!authInfo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    // Support both legacy { names: string[] } and { travellers: { name?, firstName?, lastName? }[] }
    let travellerEntries: Array<{ name: string; firstName?: string; lastName?: string }> = [];
    if (Array.isArray(body.travellers)) {
      travellerEntries = body.travellers
        .map((t: unknown) => {
          if (t && typeof t === "object") {
            const obj = t as { name?: string; firstName?: string; lastName?: string };
            const name = String(obj.name || (obj.firstName && obj.lastName ? `${obj.firstName} ${obj.lastName}` : "")).trim();
            return { name, firstName: obj.firstName?.trim(), lastName: obj.lastName?.trim() };
          }
          return null;
        })
        .filter((x: { name: string; firstName?: string; lastName?: string } | null): x is { name: string; firstName?: string; lastName?: string } => x !== null && x.name !== "");
    } else if (Array.isArray(body.names)) {
      travellerEntries = body.names
        .map((n: unknown) => ({ name: String(n || "").trim() }))
        .filter((x: { name: string }) => x.name !== "");
    }

    const uniqueEntries = Array.from(
      new Map(travellerEntries.map((e) => [e.name + (e.firstName ?? "") + (e.lastName ?? ""), e])).values()
    );

    if (uniqueEntries.length === 0) {
      return NextResponse.json({ parties: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const companyId = authInfo.companyId;
    const userId = authInfo.userId;

    const results: { name: string; id: string; displayName: string }[] = [];

    // Fetch all client parties for company once
    const { data: parties } = await supabase
      .from("party")
      .select("id, display_name")
      .eq("company_id", companyId)
      .eq("party_type", "person")
      .eq("status", "active");

    const clientPartyIds =
      parties && parties.length > 0
        ? await supabase
            .from("client_party")
            .select("party_id")
            .in("party_id", parties.map((p) => p.id))
        : { data: [] };
    const clientSet = new Set((clientPartyIds.data || []).map((r: { party_id: string }) => r.party_id));
    const clientParties = (parties || []).filter((p) => clientSet.has(p.id));
    const normalizedToParty = new Map<string, { id: string; display_name: string }>();
    for (const p of clientParties) {
      const dn = (p.display_name || "").trim();
      const norm = normalizeForMatch(dn);
      if (norm && !normalizedToParty.has(norm)) {
        normalizedToParty.set(norm, { id: p.id, display_name: dn });
      }
    }

    for (const entry of uniqueEntries) {
      const { name, firstName, lastName } = entry;
      const normalized = normalizeForMatch(name);
      const displayNorm = firstName && lastName ? normalizeForMatch(`${firstName} ${lastName}`) : normalized;
      const found = (normalized && normalizedToParty.get(normalized)) || (displayNorm && normalizedToParty.get(displayNorm)) || null;

      if (found) {
        results.push({ name, id: found.id, displayName: found.display_name });
      } else {
        const created = await createClientParty(supabase, companyId, userId, name, firstName, lastName);
        results.push({ name, id: created.id, displayName: created.displayName });
        const key = displayNorm || normalized;
        if (key) normalizedToParty.set(key, { id: created.id, display_name: created.displayName });
      }
    }

    return NextResponse.json({ parties: results });
  } catch (err) {
    console.error("find-or-create-travellers error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createClientParty(
  supabase: any,
  companyId: string,
  userId: string,
  fullName: string,
  explicitFirstName?: string,
  explicitLastName?: string
): Promise<{ id: string; displayName: string }> {
  let firstName: string;
  let lastName: string;
  if (explicitFirstName && explicitLastName) {
    firstName = explicitFirstName;
    lastName = explicitLastName;
  } else {
    // Parse fullName: "Surname, FirstName" or "FirstName Surname"
    const trimmed = fullName.trim();
    if (trimmed.includes(",")) {
      const [last, first] = trimmed.split(",").map((s) => s.trim());
      lastName = last || trimmed;
      firstName = first || "";
    } else {
      const parts = trimmed.split(/\s+/);
      firstName = parts[0] || trimmed;
      lastName = parts.slice(1).join(" ") || "";
    }
  }
  const displayName = `${firstName} ${lastName}`.trim() || fullName;

  const { data: party, error: partyErr } = await supabase
    .from("party")
    .insert({
      display_name: displayName,
      party_type: "person",
      status: "active",
      company_id: companyId,
      created_by: userId,
    })
    .select("id")
    .single();

  if (partyErr || !party) {
    throw new Error(`Failed to create party: ${partyErr?.message || "Unknown"}`);
  }

  await supabase.from("party_person").insert({
    party_id: party.id,
    first_name: firstName,
    last_name: lastName,
  });

  await supabase.from("client_party").insert({
    party_id: party.id,
    client_type: "person",
  });

  return { id: party.id, displayName };
}
