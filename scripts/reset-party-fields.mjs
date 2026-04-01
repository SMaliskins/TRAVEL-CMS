#!/usr/bin/env node
/**
 * Reset all fields for a party except first_name and last_name.
 * Usage: node --env-file=.env scripts/reset-party-fields.mjs [party_id]
 *    or: node scripts/reset-party-fields.mjs [party_id]  (with env vars in shell)
 * Default party_id: a0441b1f-5d4d-4168-8213-dcd85dfbd7c8
 */
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Load .env or .env.local if exists
for (const p of [".env", ".env.local"]) {
  if (existsSync(p)) {
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    break;
  }
}

const PARTY_ID = process.argv[2] || "a0441b1f-5d4d-4168-8213-dcd85dfbd7c8";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "dummy-key-for-build") {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. party_person: clear all except first_name, last_name
  const { error: err1 } = await supabase
    .from("party_person")
    .update({
      title: null,
      gender: null,
      dob: null,
      personal_code: null,
      citizenship: null,
      address: null,
      passport_number: null,
      passport_issue_date: null,
      passport_expiry_date: null,
      passport_issuing_country: null,
      passport_full_name: null,
      nationality: null,
      avatar_url: null,
      is_alien_passport: false,
      seat_preference: null,
      meal_preference: null,
      preferences_notes: null,
      correspondence_languages: null,
      invoice_language: null,
    })
    .eq("party_id", PARTY_ID);

  if (err1) {
    console.error("party_person update error:", err1.message);
    process.exit(1);
  }

  // 2. party: clear common fields
  const { error: err2 } = await supabase
    .from("party")
    .update({
      email: null,
      phone: null,
      country: null,
      bank_accounts: null,
      corporate_accounts: null,
      loyalty_cards: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", PARTY_ID);

  if (err2) {
    console.error("party update error:", err2.message);
    process.exit(1);
  }

  // 3. Refresh display_name from first_name + last_name
  const { data: person } = await supabase
    .from("party_person")
    .select("first_name, last_name")
    .eq("party_id", PARTY_ID)
    .single();

  if (person) {
    const displayName = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
    await supabase.from("party").update({ display_name: displayName || null }).eq("id", PARTY_ID);
  }

  console.log("Reset complete for party", PARTY_ID);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
