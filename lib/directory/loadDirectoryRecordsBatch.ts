import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DirectoryRecord } from "@/lib/types/directory";
import { buildDirectoryRecord } from "@/lib/directory/buildDirectoryRecord";

/** Columns required by `buildDirectoryRecord` after merge (avoids `select("*")` payload). Keep in sync with `buildDirectoryRecord.ts`. */
const PARTY_BATCH_COLUMNS = [
  "id",
  "company_id",
  "party_type",
  "status",
  "display_name",
  "phone",
  "email",
  "country",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "loyalty_cards",
  "corporate_accounts",
  "bank_accounts",
  "service_areas",
  "supplier_services_description",
  "supplier_website",
  "supplier_documents",
  "supplier_commissions",
].join(",");

const PARTY_PERSON_BATCH_COLUMNS = [
  "party_id",
  "title",
  "first_name",
  "last_name",
  "gender",
  "dob",
  "personal_code",
  "citizenship",
  "passport_number",
  "passport_issue_date",
  "passport_expiry_date",
  "passport_issuing_country",
  "passport_full_name",
  "nationality",
  "avatar_url",
  "is_alien_passport",
  "seat_preference",
  "meal_preference",
  "preferences_notes",
  "correspondence_languages",
  "invoice_language",
].join(",");

const PARTY_COMPANY_BATCH_COLUMNS = [
  "party_id",
  "company_name",
  "logo_url",
  "reg_number",
  "vat_number",
  "legal_address",
  "actual_address",
  "bank_name",
  "iban",
  "swift",
  "contact_person",
  "correspondence_languages",
  "invoice_language",
].join(",");

/** Only `party_id`: supplier extras live on `party`; spreading full `partner_party` could overwrite with nulls. */
const PARTNER_PARTY_ROLE_COLUMNS = "party_id";

const SUBAGENT_BATCH_COLUMNS = "party_id, commission_scheme";

type PartyBatchRow = { id: string } & Record<string, unknown>;

/**
 * Load full DirectoryRecord for many party IDs in a fixed set of batched queries (same merge rules as GET /api/directory/[id]).
 * Does not call resolveAuditDisplayNamesBatch — used only by Clients Data tab, which does not show created/updated-by labels.
 * For audit names, load a single party via GET /api/directory/[id].
 */
export async function loadDirectoryRecordsForPartyIds(
  partyIds: string[],
  companyId: string
): Promise<Map<string, DirectoryRecord>> {
  const out = new Map<string, DirectoryRecord>();
  const uniq = [...new Set(partyIds.filter(Boolean))];
  if (uniq.length === 0) return out;

  const { data: partyRows, error: partyErr } = await supabaseAdmin
    .from("party")
    .select(PARTY_BATCH_COLUMNS)
    .in("id", uniq)
    .eq("company_id", companyId);

  if (partyErr || !partyRows?.length) return out;

  const rows = partyRows as unknown as PartyBatchRow[];
  const foundIds = new Set(rows.map((p) => p.id));
  const ids = uniq.filter((id) => foundIds.has(id));
  if (ids.length === 0) return out;

  const [
    personRes,
    companyRes,
    clientRes,
    supplierRes,
    subagentRes,
    referralRes,
    referralRateRes,
  ] = await Promise.all([
    supabaseAdmin.from("party_person").select(PARTY_PERSON_BATCH_COLUMNS).in("party_id", ids),
    supabaseAdmin.from("party_company").select(PARTY_COMPANY_BATCH_COLUMNS).in("party_id", ids),
    supabaseAdmin.from("client_party").select("party_id, show_referral_in_app").in("party_id", ids),
    supabaseAdmin.from("partner_party").select(PARTNER_PARTY_ROLE_COLUMNS).in("party_id", ids),
    supabaseAdmin.from("subagents").select(SUBAGENT_BATCH_COLUMNS).in("party_id", ids),
    supabaseAdmin.from("referral_party").select("party_id, default_currency, notes").in("party_id", ids),
    supabaseAdmin.from("referral_party_category_rate").select("party_id, category_id, rate_kind, rate_value").in("party_id", ids),
  ]);

  const personRows = (personRes.data ?? []) as unknown as Array<Record<string, unknown> & { party_id: string }>;
  const companyRows = (companyRes.data ?? []) as unknown as Array<Record<string, unknown> & { party_id: string }>;
  const clientRows = (clientRes.data ?? []) as unknown as Array<{ party_id: string; show_referral_in_app?: boolean }>;
  const supplierRows = (supplierRes.data ?? []) as unknown as Array<Record<string, unknown> & { party_id: string }>;
  const subagentRows = (subagentRes.data ?? []) as unknown as Array<Record<string, unknown> & { party_id: string }>;
  const referralRows = (referralRes.data ?? []) as unknown as Array<{
    party_id: string;
    default_currency?: string;
    notes?: string | null;
  }>;
  const referralRateRows = (referralRateRes.data ?? []) as unknown as Array<{
    party_id: string;
    category_id: string;
    rate_kind: string;
    rate_value: number | string;
  }>;

  const personByParty = new Map<string, Record<string, unknown>>();
  for (const r of personRows) {
    personByParty.set(r.party_id, r);
  }
  const companyByParty = new Map<string, Record<string, unknown>>();
  for (const r of companyRows) {
    companyByParty.set(r.party_id, r);
  }
  const clientByParty = new Map<string, { show_referral_in_app?: boolean }>();
  for (const r of clientRows) {
    clientByParty.set(r.party_id, r);
  }
  const supplierByParty = new Map<string, Record<string, unknown>>();
  for (const r of supplierRows) {
    supplierByParty.set(r.party_id, r);
  }
  const subagentByParty = new Map<string, Record<string, unknown>>();
  for (const r of subagentRows) {
    subagentByParty.set(r.party_id, r);
  }
  const referralByParty = new Map<string, { default_currency?: string; notes?: string | null }>();
  for (const r of referralRows) {
    referralByParty.set(r.party_id, r);
  }
  const ratesByParty = new Map<string, { category_id: string; rate_kind: string; rate_value: number | string }[]>();
  for (const r of referralRateRows) {
    const pid = r.party_id;
    if (!ratesByParty.has(pid)) ratesByParty.set(pid, []);
    ratesByParty.get(pid)!.push({
      category_id: r.category_id,
      rate_kind: r.rate_kind,
      rate_value: r.rate_value,
    });
  }

  const partyById = new Map(rows.map((p) => [p.id, p] as const));

  for (const partyId of ids) {
    const party = partyById.get(partyId);
    if (!party) continue;
    const personData = personByParty.get(partyId);
    const companyData = companyByParty.get(partyId);
    const clientData = clientByParty.get(partyId);
    const supplierData = supplierByParty.get(partyId);
    const subagentData = subagentByParty.get(partyId);
    const referralData = referralByParty.get(partyId);
    const referralRatesData = ratesByParty.get(partyId) || [];

    const merged = {
      ...party,
      ...(personData || {}),
      ...(companyData || {}),
      is_client: !!clientData,
      show_referral_in_app: clientData?.show_referral_in_app,
      is_supplier: !!supplierData,
      is_subagent: !!subagentData,
      is_referral: !!referralData,
      referral_default_currency: referralData?.default_currency,
      referral_notes: referralData?.notes,
      referral_category_rates: referralRatesData,
      ...(supplierData || {}),
      ...(subagentData || {}),
      id: (party as { id: string }).id,
      created_by: (party as { created_by?: string }).created_by,
      updated_by: (party as { updated_by?: string }).updated_by,
      created_at: (party as { created_at?: string }).created_at,
      updated_at: (party as { updated_at?: string }).updated_at,
    };

    out.set(partyId, buildDirectoryRecord(merged));
  }

  return out;
}
