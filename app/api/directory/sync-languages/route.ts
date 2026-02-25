import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

const COUNTRY_TO_LANG: Record<string, string> = {
  latvia: "lv", lva: "lv",
  estonia: "et", est: "et",
  lithuania: "lt", ltu: "lt",
  ukraine: "uk", ukr: "uk",
  russia: "ru", rus: "ru",
  germany: "de", deu: "de",
  poland: "pl", pol: "pl",
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const userCompanyId = profile?.company_id ?? null;
    if (!userCompanyId) {
      return NextResponse.json(
        { error: "User has no company", updated: 0, skipped: 0 },
        { status: 200 }
      );
    }

    // Fetch party_person rows for person clients with passport_issuing_country
    // that have default languages (en or null)
    const { data: parties } = await supabaseAdmin
      .from("party")
      .select("id")
      .eq("company_id", userCompanyId)
      .eq("party_type", "person")
      .eq("status", "active");

    if (!parties?.length) {
      return NextResponse.json({ updated: 0, skipped: 0 });
    }

    const partyIds = parties.map((p) => p.id);

    const { data: clientIds } = await supabaseAdmin
      .from("client_party")
      .select("party_id")
      .in("party_id", partyIds);

    const clientPartyIds = new Set((clientIds || []).map((c) => c.party_id));

    const { data: persons } = await supabaseAdmin
      .from("party_person")
      .select("party_id, passport_issuing_country, correspondence_languages, invoice_language")
      .in("party_id", partyIds);

    let updated = 0;
    let skipped = 0;

    for (const p of persons || []) {
      if (!clientPartyIds.has(p.party_id)) continue; // only person clients
      const country = (p.passport_issuing_country || "").trim();
      if (!country) continue;

      const corrLangs = Array.isArray(p.correspondence_languages) ? p.correspondence_languages : [];
      const invLang = p.invoice_language || "en";
      const isDefaultLangs = (corrLangs.length === 0 || (corrLangs.length === 1 && corrLangs[0] === "en")) && invLang === "en";
      if (!isDefaultLangs) {
        skipped++;
        continue;
      }

      const c = country.toLowerCase().replace(/\s/g, "");
      const lang = COUNTRY_TO_LANG[c];
      if (!lang) {
        skipped++;
        continue;
      }

      const { error } = await supabaseAdmin
        .from("party_person")
        .update({
          correspondence_languages: [lang],
          invoice_language: lang,
        })
        .eq("party_id", p.party_id);

      if (!error) updated++;
    }

    return NextResponse.json({ updated, skipped });
  } catch (err) {
    console.error("Sync languages error:", err);
    return NextResponse.json(
      { error: "Failed to sync languages" },
      { status: 500 }
    );
  }
}
