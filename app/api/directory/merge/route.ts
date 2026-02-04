/**
 * POST /api/directory/merge
 *
 * Merge source contact into target contact:
 * - Transfer all orders (client_party_id) from source to target
 * - Transfer all order_services (client_party_id, payer_party_id, supplier_party_id)
 * - Transfer all invoices (payer_party_id)
 * - Transfer order_travellers (party_id)
 * - Merge roles (client_party, partner_party, subagents) from source into target
 * - Archive source party (status=inactive; DB enum has active/inactive/blocked only)
 *
 * Body: { sourcePartyId: string; targetPartyId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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
    const sourcePartyId = body.sourcePartyId as string;
    const targetPartyId = body.targetPartyId as string;

    if (!sourcePartyId || !targetPartyId) {
      return NextResponse.json(
        { error: "sourcePartyId and targetPartyId are required" },
        { status: 400 }
      );
    }

    if (sourcePartyId === targetPartyId) {
      return NextResponse.json(
        { error: "Source and target must be different" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;
    const companyId = authInfo.companyId;

    // Verify both parties exist and belong to company
    const { data: parties, error: partiesErr } = await supabase
      .from("party")
      .select("id, display_name, company_id")
      .in("id", [sourcePartyId, targetPartyId]);

    if (partiesErr || !parties || parties.length !== 2) {
      return NextResponse.json(
        { error: "One or both parties not found" },
        { status: 404 }
      );
    }

    const sourceParty = parties.find((p) => p.id === sourcePartyId);
    const targetParty = parties.find((p) => p.id === targetPartyId);

    if (!sourceParty || !targetParty || sourceParty.company_id !== companyId || targetParty.company_id !== companyId) {
      return NextResponse.json(
        { error: "Parties must belong to your company" },
        { status: 403 }
      );
    }

    // 1. Update orders: client_party_id
    const { error: ordersErr } = await supabase
      .from("orders")
      .update({ client_party_id: targetPartyId })
      .eq("client_party_id", sourcePartyId)
      .eq("company_id", companyId);

    if (ordersErr) {
      console.error("Merge: orders update error:", ordersErr);
      return NextResponse.json(
        { error: "Failed to merge orders", details: ordersErr.message },
        { status: 500 }
      );
    }

    // 2. Update order_services: client_party_id, payer_party_id, supplier_party_id
    const { data: services } = await supabase
      .from("order_services")
      .select("id")
      .or(`client_party_id.eq.${sourcePartyId},payer_party_id.eq.${sourcePartyId},supplier_party_id.eq.${sourcePartyId}`);

    if (services && services.length > 0) {
      for (const svc of services) {
        const { data: s } = await supabase.from("order_services").select("client_party_id, payer_party_id, supplier_party_id").eq("id", svc.id).single();
        const updates: Record<string, string | null> = {};
        if (s?.client_party_id === sourcePartyId) updates.client_party_id = targetPartyId;
        if (s?.payer_party_id === sourcePartyId) updates.payer_party_id = targetPartyId;
        if (s?.supplier_party_id === sourcePartyId) updates.supplier_party_id = targetPartyId;
        if (Object.keys(updates).length > 0) {
          await supabase.from("order_services").update(updates).eq("id", svc.id);
        }
      }
    }

    // 3. Update invoices: payer_party_id (invoices are under orders)
    const { error: invErr } = await supabase
      .from("invoices")
      .update({ payer_party_id: targetPartyId })
      .eq("payer_party_id", sourcePartyId);

    if (invErr) {
      console.error("Merge: invoices update error:", invErr);
    }

    // 4. Update order_travellers: party_id
    const { error: travErr } = await supabase
      .from("order_travellers")
      .update({ party_id: targetPartyId })
      .eq("party_id", sourcePartyId);

    if (travErr) {
      console.error("Merge: order_travellers update error:", travErr);
    }

    // 5. Merge roles: ensure target has all roles from source
    const { data: srcClient } = await supabase.from("client_party").select("party_id").eq("party_id", sourcePartyId).maybeSingle();
    const { data: tgtClient } = await supabase.from("client_party").select("party_id").eq("party_id", targetPartyId).maybeSingle();
    if (srcClient && !tgtClient) {
      await supabase.from("client_party").insert({ party_id: targetPartyId, client_type: "person" });
    }

    const { data: srcPartner } = await supabase.from("partner_party").select("party_id").eq("party_id", sourcePartyId).maybeSingle();
    const { data: tgtPartner } = await supabase.from("partner_party").select("party_id").eq("party_id", targetPartyId).maybeSingle();
    if (srcPartner && !tgtPartner) {
      await supabase.from("partner_party").insert({ party_id: targetPartyId });
    }

    const { data: srcSubagent } = await supabase.from("subagents").select("party_id").eq("party_id", sourcePartyId).maybeSingle();
    const { data: tgtSubagent } = await supabase.from("subagents").select("party_id").eq("party_id", targetPartyId).maybeSingle();
    if (srcSubagent && !tgtSubagent) {
      await supabase.from("subagents").insert({ party_id: targetPartyId });
    }

    // 6. Archive source party (use "inactive" — party_status enum has active/inactive/blocked only)
    const { error: archiveErr } = await supabase
      .from("party")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", sourcePartyId);

    if (archiveErr) {
      console.error("Merge: archive error:", archiveErr);
      return NextResponse.json(
        { error: "Failed to archive source contact", details: archiveErr.message },
        { status: 500 }
      );
    }

    // Delete source from role tables (archived party should not appear in role lists)
    await supabase.from("client_party").delete().eq("party_id", sourcePartyId);
    await supabase.from("partner_party").delete().eq("party_id", sourcePartyId);
    await supabase.from("subagents").delete().eq("party_id", sourcePartyId);

    return NextResponse.json({
      success: true,
      message: `Merged ${sourceParty.display_name || "contact"} into ${targetParty.display_name || "contact"}`,
      targetPartyId,
    });
  } catch (err) {
    console.error("Directory merge error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
