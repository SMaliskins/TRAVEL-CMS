/**
 * POST /api/parties/find-or-create-travellers
 *
 * For each traveller:
 * - Search existing clients with diacritic-insensitive matching (garumzīmes, mīkstinājumzīmes ignored)
 * - If found: return existing party id and display_name
 * - If not found: create new client party, return new id and display_name
 *
 * Body: { names: string[] } OR { travellers: [...], matchOnly?: boolean }
 * When matchOnly is true: do not create parties; return id: null and matched: false when no directory match.
 * When travellers have explicit firstName/lastName (from AI parsing), use them directly.
 * Otherwise split name: if "Surname, FirstName" use comma split; else assume "FirstName Surname".
 *
 * Returns: { parties: { name: string; id: string | null; displayName: string; matched: boolean }[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function tokenBag(s: string): string[] {
  return normalizeForMatch(s)
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 0);
}

function tokenSetsEqual(a: string, b: string): boolean {
  const ta = [...tokenBag(a)].sort().join("\u0001");
  const tb = [...tokenBag(b)].sort().join("\u0001");
  return ta.length > 0 && ta === tb;
}

/** Every significant token from a appears in b (handles extra middle names in DB). */
function allTokensFromAInB(a: string, b: string): boolean {
  const aa = tokenBag(a);
  const bSet = new Set(tokenBag(b));
  if (aa.length === 0) return false;
  return aa.every((t) => bSet.has(t));
}

/** First letter of each name-part matches (sorted), same count — for minor OCR/spacing issues when surnames also align. */
function firstInitialsMatch(
  fnA: string,
  lnA: string,
  fnB: string,
  lnB: string
): boolean {
  const partsA = [...tokenBag(fnA), ...tokenBag(lnA)];
  const partsB = [...tokenBag(fnB), ...tokenBag(lnB)];
  if (partsA.length < 2 || partsB.length < 2 || partsA.length !== partsB.length) return false;
  const ia = partsA
    .map((t) => t[0])
    .sort()
    .join("");
  const ib = partsB
    .map((t) => t[0])
    .sort()
    .join("");
  return ia === ib;
}

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

type PartyRow = { id: string; display_name: string };
type PersonRow = { party_id: string; first_name: string; last_name: string };

function tryMatchTravellerToParty(
  entry: { name: string; firstName?: string; lastName?: string },
  parties: PartyRow[],
  personMap: Map<string, PersonRow>,
  normalizedToParty: Map<string, PartyRow>
): PartyRow | null {
  const { name, firstName, lastName } = entry;
  const normalized = normalizeForMatch(name);
  const displayNorm = firstName && lastName ? normalizeForMatch(`${firstName} ${lastName}`) : normalized;
  const reverseNorm = firstName && lastName ? normalizeForMatch(`${lastName} ${firstName}`) : null;
  const quick =
    (normalized && normalizedToParty.get(normalized)) ||
    (displayNorm && normalizedToParty.get(displayNorm)) ||
    (reverseNorm && normalizedToParty.get(reverseNorm)) ||
    null;
  if (quick) return quick;

  const entryStrs: string[] = [name];
  if (firstName && lastName) {
    entryStrs.push(`${firstName} ${lastName}`, `${lastName} ${firstName}`);
  }

  for (const p of parties) {
    const pd = personMap.get(p.id);
    const partyStrs: string[] = [(p.display_name || "").trim()];
    if (pd) {
      const fn = (pd.first_name || "").trim();
      const ln = (pd.last_name || "").trim();
      if (fn || ln) {
        partyStrs.push(`${fn} ${ln}`.trim(), `${ln} ${fn}`.trim());
      }
    }

    for (const es of entryStrs) {
      if (!es.trim()) continue;
      const norm = normalizeForMatch(es);
      if (norm && normalizeForMatch(p.display_name || "") === norm) {
        return p;
      }
      for (const ps of partyStrs) {
        if (!ps.trim()) continue;
        if (tokenSetsEqual(es, ps)) return p;
        if (tokenBag(es).length >= 2 && allTokensFromAInB(es, ps)) return p;
        if (tokenBag(ps).length >= 2 && allTokensFromAInB(ps, es)) return p;
      }
    }

    if (pd && firstName && lastName) {
      const fn = (pd.first_name || "").trim();
      const ln = (pd.last_name || "").trim();
      if (fn && ln && firstInitialsMatch(firstName, lastName, fn, ln)) {
        const a = normalizeForMatch(lastName).replace(/\s/g, "");
        const b = normalizeForMatch(ln).replace(/\s/g, "");
        if (a.length >= 3 && b.length >= 3 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)))) {
          return p;
        }
      }
    }
  }

  return null;
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
    const matchOnly = body.matchOnly === true;
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

    const results: { name: string; id: string | null; displayName: string; matched: boolean }[] = [];

    // Fetch all person parties for company (not just clients — match any existing person)
    const { data: parties } = await supabase
      .from("party")
      .select("id, display_name")
      .eq("company_id", companyId)
      .eq("party_type", "person")
      .eq("status", "active");

    // Also fetch first_name/last_name for better matching
    const partyIds = (parties || []).map((p: { id: string }) => p.id);
    let personDetails: Array<{ party_id: string; first_name: string; last_name: string }> = [];
    if (partyIds.length > 0) {
      const { data: pd } = await supabase
        .from("party_person")
        .select("party_id, first_name, last_name")
        .in("party_id", partyIds);
      personDetails = pd || [];
    }
    const personMap = new Map(personDetails.map((p) => [p.party_id, p]));

    const normalizedToParty = new Map<string, PartyRow>();
    for (const p of (parties || [])) {
      const dn = (p.display_name || "").trim();
      const row: PartyRow = { id: p.id, display_name: dn };
      const norm = normalizeForMatch(dn);
      if (norm && !normalizedToParty.has(norm)) {
        normalizedToParty.set(norm, row);
      }
      const pd = personMap.get(p.id);
      if (pd) {
        const fnln = normalizeForMatch(`${pd.first_name || ""} ${pd.last_name || ""}`.trim());
        const lnfn = normalizeForMatch(`${pd.last_name || ""} ${pd.first_name || ""}`.trim());
        if (fnln && !normalizedToParty.has(fnln)) normalizedToParty.set(fnln, row);
        if (lnfn && !normalizedToParty.has(lnfn)) normalizedToParty.set(lnfn, row);
      }
    }

    // Ensure existing records get client role if missing
    const clientPartyIds = partyIds.length > 0
      ? await supabase.from("client_party").select("party_id").in("party_id", partyIds)
      : { data: [] };
    const clientSet = new Set((clientPartyIds.data || []).map((r: { party_id: string }) => r.party_id));

    const partyList: PartyRow[] = (parties || []).map((p: { id: string; display_name: string }) => ({
      id: p.id,
      display_name: (p.display_name || "").trim(),
    }));

    for (const entry of uniqueEntries) {
      const { name, firstName, lastName } = entry;
      const found = tryMatchTravellerToParty(entry, partyList, personMap, normalizedToParty);

      if (found) {
        if (!clientSet.has(found.id)) {
          await supabase.from("client_party").insert({ party_id: found.id, client_type: "person" }).select();
          clientSet.add(found.id);
        }
        results.push({ name, id: found.id, displayName: found.display_name, matched: true });
      } else if (matchOnly) {
        results.push({ name, id: null, displayName: name, matched: false });
      } else {
        const created = await createClientParty(supabase, companyId, userId, name, firstName, lastName);
        results.push({ name, id: created.id, displayName: created.displayName, matched: true });
        const displayNorm = firstName && lastName ? normalizeForMatch(`${firstName} ${lastName}`) : normalizeForMatch(name);
        if (displayNorm) normalizedToParty.set(displayNorm, { id: created.id, display_name: created.displayName });
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
