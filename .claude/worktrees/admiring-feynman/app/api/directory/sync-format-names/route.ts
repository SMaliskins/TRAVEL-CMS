import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { formatNameForDb } from "@/utils/nameFormat";

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

    const { data: parties } = await supabaseAdmin
      .from("party")
      .select("id")
      .eq("company_id", userCompanyId)
      .eq("party_type", "person");

    if (!parties?.length) {
      return NextResponse.json({ updated: 0, skipped: 0 });
    }

    const partyIds = parties.map((p) => p.id);

    const { data: persons } = await supabaseAdmin
      .from("party_person")
      .select("party_id, first_name, last_name")
      .in("party_id", partyIds);

    let updated = 0;
    let skipped = 0;

    // Build map of party_id -> display_name (formatted) for all person parties
    const partyDisplayNames = new Map<string, string>();
    for (const p of persons || []) {
      const fnFormatted = formatNameForDb(p.first_name || "");
      const lnFormatted = formatNameForDb(p.last_name || "");
      const displayName = [fnFormatted, lnFormatted].filter(Boolean).join(" ");
      if (displayName) partyDisplayNames.set(p.party_id, displayName);
    }

    for (const p of persons || []) {
      const fnFormatted = formatNameForDb(p.first_name || "");
      const lnFormatted = formatNameForDb(p.last_name || "");
      const fnOriginal = (p.first_name || "").trim();
      const lnOriginal = (p.last_name || "").trim();

      if (fnFormatted === fnOriginal && lnFormatted === lnOriginal) {
        skipped++;
        continue;
      }

      const { error } = await supabaseAdmin
        .from("party_person")
        .update({
          first_name: fnFormatted,
          last_name: lnFormatted,
        })
        .eq("party_id", p.party_id);

      if (!error) {
        const displayName = [fnFormatted, lnFormatted].filter(Boolean).join(" ");
        if (displayName) {
          await supabaseAdmin
            .from("party")
            .update({ display_name: displayName })
            .eq("id", p.party_id);
        }
        updated++;
      }
    }

    // Sync orders.client_display_name and order_services payer_name from formatted names
    for (const [partyId, displayName] of partyDisplayNames) {
      await supabaseAdmin
        .from("orders")
        .update({ client_display_name: displayName })
        .eq("client_party_id", partyId)
        .eq("company_id", userCompanyId);
      await supabaseAdmin
        .from("order_services")
        .update({ payer_name: displayName })
        .eq("payer_party_id", partyId)
        .eq("company_id", userCompanyId);
    }

    return NextResponse.json({ updated, skipped });
  } catch (err) {
    console.error("Sync format names error:", err);
    return NextResponse.json(
      { error: "Failed to sync name format" },
      { status: 500 }
    );
  }
}
