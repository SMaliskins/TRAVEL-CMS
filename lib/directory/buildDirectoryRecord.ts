import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DirectoryRecord, DirectoryRole } from "@/lib/types/directory";

/**
 * Build DirectoryRecord from merged database rows (same as GET /api/directory/[id]).
 */
export function buildDirectoryRecord(row: any): DirectoryRecord {
  const roles: DirectoryRole[] = [];
  if (row.is_client) roles.push("client");
  if (row.is_supplier) roles.push("supplier");
  if (row.is_subagent) roles.push("subagent");
  if (row.is_referral) roles.push("referral");

  const pt = String(row.party_type ?? "").toLowerCase();
  const isCompanyParty = pt === "company";
  const isPersonParty = pt === "person";
  const hasNonEmptyStr = (v: unknown) => v != null && String(v).trim() !== "";
  const hasPersonRowData =
    hasNonEmptyStr(row.first_name) ||
    hasNonEmptyStr(row.last_name) ||
    row.dob != null ||
    hasNonEmptyStr(row.passport_number) ||
    row.passport_issue_date != null ||
    row.passport_expiry_date != null ||
    hasNonEmptyStr(row.personal_code);
  const includePersonProfile = isPersonParty || (!isCompanyParty && hasPersonRowData);

  const record: DirectoryRecord = {
    id: row.id,
    type: isCompanyParty ? "company" : "person",
    roles,
    isActive: row.status === "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includePersonProfile) {
    record.title = row.title || undefined;
    record.firstName = row.first_name || undefined;
    record.lastName = row.last_name || undefined;
    record.gender = row.gender || undefined;
    record.dob = row.dob || undefined;
    record.personalCode = row.personal_code || undefined;
    record.citizenship = row.citizenship || undefined;
    record.passportNumber = row.passport_number || undefined;
    record.passportIssueDate = row.passport_issue_date || undefined;
    record.passportExpiryDate = row.passport_expiry_date || undefined;
    record.passportIssuingCountry = row.passport_issuing_country || undefined;
    record.passportFullName = row.passport_full_name || undefined;
    record.nationality = row.nationality || undefined;
    record.avatarUrl = row.avatar_url || undefined;
    record.isAlienPassport = row.is_alien_passport === true;
    record.seatPreference =
      row.seat_preference === "window" || row.seat_preference === "aisle" ? row.seat_preference : undefined;
    record.mealPreference = row.meal_preference || undefined;
    record.preferencesNotes = row.preferences_notes || undefined;
  }

  if (row.bank_accounts && Array.isArray(row.bank_accounts) && row.bank_accounts.length > 0) {
    record.bankAccounts = row.bank_accounts.map((a: { bank_name?: string; bankName?: string; iban?: string; swift?: string }) => ({
      bankName: a.bank_name || a.bankName || "",
      iban: a.iban || "",
      swift: a.swift || "",
    })).filter((a: { bankName: string; iban: string }) => a.bankName?.trim() || a.iban?.trim());
  } else if (row.bank_name || row.iban || row.swift) {
    record.bankAccounts = [
      {
        bankName: row.bank_name || "",
        iban: row.iban || "",
        swift: row.swift || "",
      },
    ];
    record.bankName = row.bank_name || undefined;
    record.iban = row.iban || undefined;
    record.swift = row.swift || undefined;
  }

  if (isCompanyParty) {
    record.companyName = row.company_name || row.display_name || undefined;
    record.companyAvatarUrl = row.logo_url || undefined;
    record.regNumber = row.reg_number || undefined;
    record.vatNumber = row.vat_number || undefined;
    record.legalAddress = row.legal_address || undefined;
    record.actualAddress = row.actual_address || undefined;
    if (!record.bankName) record.bankName = row.bank_name || undefined;
    if (!record.iban) record.iban = row.iban || undefined;
    if (!record.swift) record.swift = row.swift || undefined;
  }

  record.phone = row.phone || undefined;
  record.email = row.email || undefined;
  record.country = row.country || undefined;

  if (isCompanyParty) {
    record.contactPerson = row.contact_person || undefined;
    if (Array.isArray(row.correspondence_languages)) {
      record.correspondenceLanguages = row.correspondence_languages;
    } else if (row.correspondence_language) {
      record.correspondenceLanguages = [row.correspondence_language];
    } else {
      record.correspondenceLanguages = ["en"];
    }
    record.invoiceLanguage = row.invoice_language || undefined;
  }
  if (includePersonProfile) {
    if (Array.isArray(row.correspondence_languages) && row.correspondence_languages.length > 0) {
      record.correspondenceLanguages = row.correspondence_languages;
    } else if (row.correspondence_language) {
      record.correspondenceLanguages = [row.correspondence_language];
    } else {
      record.correspondenceLanguages = ["en"];
    }
    record.invoiceLanguage = row.invoice_language || "en";
  }

  if (row.corporate_accounts) record.corporateAccounts = row.corporate_accounts;
  if (row.loyalty_cards) record.loyaltyCards = row.loyalty_cards;

  if (row.created_by) record.createdById = row.created_by;
  if (row.updated_by) record.updatedById = row.updated_by;

  if (row.is_supplier) {
    record.supplierExtras = {
      serviceAreas: row.service_areas || undefined,
      serviceDescription: row.supplier_services_description || undefined,
      website: row.supplier_website || undefined,
      documents: row.supplier_documents || undefined,
      commissions: row.supplier_commissions || undefined,
      isPeriodicSupplier: row.is_periodic_supplier === true,
    };
  }

  if (row.is_subagent) {
    record.subagentExtras = {
      commissionType: row.commission_scheme === "revenue" ? "percentage" : row.commission_scheme === "profit" ? "fixed" : undefined,
    };
  }

  if (row.is_referral) {
    const rates = Array.isArray(row.referral_category_rates) ? row.referral_category_rates : [];
    record.referralExtras = {
      defaultCurrency: row.referral_default_currency || "EUR",
      notes: row.referral_notes || undefined,
      categoryRates: rates.map((r: { category_id: string; rate_kind: string; rate_value: number | string }) => ({
        categoryId: r.category_id,
        rateKind: r.rate_kind === "fixed" ? "fixed" : "percent",
        rateValue: Number(r.rate_value),
      })),
    };
  }

  if (row.is_client) {
    record.showReferralInApp = !!row.show_referral_in_app;
    if (row.default_referral_party_id !== undefined) {
      record.defaultReferralPartyId = row.default_referral_party_id || null;
    }
    if (row.default_referral_party_display_name !== undefined) {
      record.defaultReferralPartyDisplayName = row.default_referral_party_display_name || undefined;
    }
    if (row.client_last_travel_date !== undefined) {
      record.clientLastTravelDate = row.client_last_travel_date ?? null;
    }
  }

  return record;
}

/** Resolve created_by / updated_by to display names — deduped across records. */
export async function resolveAuditDisplayNamesBatch(records: DirectoryRecord[]): Promise<void> {
  const uniq = new Set<string>();
  for (const r of records) {
    if (r.createdById) uniq.add(r.createdById);
    if (r.updatedById) uniq.add(r.updatedById);
  }
  const ids = [...uniq];
  if (ids.length === 0) return;

  const byId = new Map<string, string>();
  const { data: userProfilesById } = await supabaseAdmin
    .from("user_profiles")
    .select("id, first_name, last_name")
    .in("id", ids);
  (userProfilesById || []).forEach((p: { id: string; first_name: string | null; last_name: string | null }) => {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    if (name) byId.set(p.id, name);
  });
  let missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const { data: userProfilesByUserId } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", missing);
    (userProfilesByUserId || []).forEach((p: { user_id: string; first_name: string | null; last_name: string | null }) => {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      if (name) byId.set(p.user_id, name);
    });
    missing = ids.filter((id) => !byId.has(id));
  }
  if (missing.length > 0) {
    const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", missing);
    (profiles || []).forEach((p: { user_id: string; display_name: string | null }) => {
      const name = (p.display_name || "").trim();
      if (name) byId.set(p.user_id, name);
    });
    missing = ids.filter((id) => !byId.has(id));
  }
  for (const uid of missing) {
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(uid);
      if (authData?.user) {
        const meta = authData.user.user_metadata;
        const name =
          (meta?.full_name as string) ||
          (meta?.name as string) ||
          [meta?.first_name, meta?.last_name].filter(Boolean).join(" ").trim() ||
          authData.user.email?.trim() ||
          null;
        if (name) byId.set(uid, name);
      }
    } catch {
      // ignore
    }
  }

  for (const record of records) {
    if (record.createdById) record.createdByDisplayName = byId.get(record.createdById) ?? "Unknown";
    if (record.updatedById) record.updatedByDisplayName = byId.get(record.updatedById) ?? "Unknown";
  }
}

export async function resolveAuditDisplayNames(record: DirectoryRecord): Promise<void> {
  await resolveAuditDisplayNamesBatch([record]);
}
