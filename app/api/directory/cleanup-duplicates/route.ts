import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

/**
 * POST /api/directory/cleanup-duplicates
 *
 * Finds duplicate party records (same display_name + company_id + party_type + status=active)
 * and merges them: keeps the "best" record (has avatar, lower display_id = older),
 * reassigns all FK references from duplicates to the keeper, then deletes duplicates.
 *
 * Body: { dryRun?: boolean }  (default true — only shows what would be merged)
 */
export async function POST(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dryRun !== false; // default: true (safe)
  const companyId = body.allCompanies ? null : auth.companyId;

  // 1. Find all active parties (paginated — Supabase caps at 1000 per request)
  const allParties: Array<{
    id: string; display_name: string; display_id: number;
    party_type: string; email: string | null; phone: string | null; company_id: string;
  }> = [];
  let fetchErr: { message: string } | null = null;
  const PAGE_SIZE = 1000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let q = supabaseAdmin
      .from("party")
      .select("id, display_name, display_id, party_type, email, phone, company_id")
      .eq("status", "active")
      .order("display_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (companyId) q = q.eq("company_id", companyId);

    const { data, error } = await q;
    if (error) { fetchErr = error; break; }
    if (!data || data.length === 0) break;
    allParties.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  if (fetchErr || !allParties) {
    return NextResponse.json({ error: "Failed to fetch parties", details: fetchErr?.message }, { status: 500 });
  }

  // 2. Fetch avatar info for persons
  const personIds = allParties.filter((p) => p.party_type === "person").map((p) => p.id);
  let avatarMap = new Map<string, string>();
  if (personIds.length > 0) {
    const { data: persons } = await supabaseAdmin
      .from("party_person")
      .select("party_id, avatar_url")
      .in("party_id", personIds);
    if (persons) {
      for (const p of persons) {
        if (p.avatar_url) avatarMap.set(p.party_id, p.avatar_url);
      }
    }
  }

  // 3. Group by normalized key: lowercase(display_name) + party_type + company_id
  const groups = new Map<string, typeof allParties>();
  for (const p of allParties) {
    const key = `${(p.display_name || "").trim().toLowerCase()}|${p.party_type}|${p.company_id}`;
    const arr = groups.get(key) || [];
    arr.push(p);
    groups.set(key, arr);
  }

  // 4. Find duplicate groups (more than 1 record per key)
  const duplicateGroups: Array<{
    name: string;
    type: string;
    keeper: { id: string; displayId: number; hasAvatar: boolean; email: string | null; phone: string | null };
    toRemove: Array<{ id: string; displayId: number; hasAvatar: boolean }>;
  }> = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    // Pick keeper: prefer one with avatar, then with email, then with phone, then lowest display_id
    const sorted = [...group].sort((a, b) => {
      const aAvatar = avatarMap.has(a.id) ? 1 : 0;
      const bAvatar = avatarMap.has(b.id) ? 1 : 0;
      if (bAvatar !== aAvatar) return bAvatar - aAvatar;
      const aEmail = a.email ? 1 : 0;
      const bEmail = b.email ? 1 : 0;
      if (bEmail !== aEmail) return bEmail - aEmail;
      const aPhone = a.phone ? 1 : 0;
      const bPhone = b.phone ? 1 : 0;
      if (bPhone !== aPhone) return bPhone - aPhone;
      return (a.display_id || 0) - (b.display_id || 0);
    });

    const keeper = sorted[0];
    const toRemove = sorted.slice(1);

    duplicateGroups.push({
      name: keeper.display_name,
      type: keeper.party_type,
      keeper: {
        id: keeper.id,
        displayId: keeper.display_id,
        hasAvatar: avatarMap.has(keeper.id),
        email: keeper.email,
        phone: keeper.phone,
      },
      toRemove: toRemove.map((r) => ({
        id: r.id,
        displayId: r.display_id,
        hasAvatar: avatarMap.has(r.id),
      })),
    });
  }

  if (duplicateGroups.length === 0) {
    return NextResponse.json({ message: "No duplicates found", groups: 0, removed: 0 });
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      groups: duplicateGroups.length,
      totalToRemove: duplicateGroups.reduce((sum, g) => sum + g.toRemove.length, 0),
      details: duplicateGroups.map((g) => ({
        name: g.name,
        type: g.type,
        keeperId: g.keeper.id,
        keeperDisplayId: g.keeper.displayId,
        keeperHasAvatar: g.keeper.hasAvatar,
        removeIds: g.toRemove.map((r) => ({ id: r.id, displayId: r.displayId, hasAvatar: r.hasAvatar })),
      })),
    });
  }

  // 5. Execute merge for each group
  let totalRemoved = 0;
  const errors: string[] = [];

  for (const group of duplicateGroups) {
    const keeperId = group.keeper.id;
    const removeIds = group.toRemove.map((r) => r.id);

    try {
      // Reassign order_travellers
      for (const rid of removeIds) {
        // Check if keeper already exists in order_travellers for same order
        const { data: travRows } = await supabaseAdmin
          .from("order_travellers")
          .select("id, order_id")
          .eq("party_id", rid);

        for (const row of (travRows || [])) {
          const { data: existing } = await supabaseAdmin
            .from("order_travellers")
            .select("id")
            .eq("order_id", row.order_id)
            .eq("party_id", keeperId)
            .limit(1);

          if (existing && existing.length > 0) {
            // Keeper already in this order — just delete the duplicate row
            await supabaseAdmin.from("order_travellers").delete().eq("id", row.id);
          } else {
            // Reassign to keeper
            await supabaseAdmin.from("order_travellers").update({ party_id: keeperId }).eq("id", row.id);
          }
        }
      }

      // Reassign orders.client_party_id
      let ordersQuery = supabaseAdmin
        .from("orders")
        .update({ client_party_id: keeperId })
        .in("client_party_id", removeIds);
      if (companyId) ordersQuery = ordersQuery.eq("company_id", companyId);
      await ordersQuery;

      // Reassign order_services FK columns
      for (const col of ["client_party_id", "payer_party_id", "supplier_party_id"]) {
        await supabaseAdmin
          .from("order_services")
          .update({ [col]: keeperId })
          .in(col, removeIds);
      }

      // Reassign invoices.payer_party_id
      await supabaseAdmin
        .from("invoices")
        .update({ payer_party_id: keeperId })
        .in("payer_party_id", removeIds);

      // Reassign company_contacts
      for (const rid of removeIds) {
        // contact_party_id
        const { data: ccRows } = await supabaseAdmin
          .from("company_contacts")
          .select("id, company_party_id, role")
          .eq("contact_party_id", rid);

        for (const cc of (ccRows || [])) {
          const { data: existing } = await supabaseAdmin
            .from("company_contacts")
            .select("id")
            .eq("company_party_id", cc.company_party_id)
            .eq("contact_party_id", keeperId)
            .eq("role", cc.role)
            .limit(1);

          if (existing && existing.length > 0) {
            await supabaseAdmin.from("company_contacts").delete().eq("id", cc.id);
          } else {
            await supabaseAdmin.from("company_contacts").update({ contact_party_id: keeperId }).eq("id", cc.id);
          }
        }

        // company_party_id
        const { data: cpRows } = await supabaseAdmin
          .from("company_contacts")
          .select("id, contact_party_id, role")
          .eq("company_party_id", rid);

        for (const cp of (cpRows || [])) {
          const { data: existing } = await supabaseAdmin
            .from("company_contacts")
            .select("id")
            .eq("company_party_id", keeperId)
            .eq("contact_party_id", cp.contact_party_id)
            .eq("role", cp.role)
            .limit(1);

          if (existing && existing.length > 0) {
            await supabaseAdmin.from("company_contacts").delete().eq("id", cp.id);
          } else {
            await supabaseAdmin.from("company_contacts").update({ company_party_id: keeperId }).eq("id", cp.id);
          }
        }
      }

      // Delete party_embeddings for duplicates
      await supabaseAdmin
        .from("party_embeddings")
        .delete()
        .in("party_id", removeIds);

      // Delete duplicate client_party rows (to avoid FK constraint on party delete)
      await supabaseAdmin
        .from("client_party")
        .delete()
        .in("party_id", removeIds);

      // Delete duplicate partner_party rows
      await supabaseAdmin
        .from("partner_party")
        .delete()
        .in("party_id", removeIds);

      // Delete duplicate subagents rows
      await supabaseAdmin
        .from("subagents")
        .delete()
        .in("party_id", removeIds);

      // Delete duplicate party_person / party_company rows (CASCADE should handle, but be explicit)
      await supabaseAdmin
        .from("party_person")
        .delete()
        .in("party_id", removeIds);

      await supabaseAdmin
        .from("party_company")
        .delete()
        .in("party_id", removeIds);

      // Finally delete duplicate party records
      const { error: delErr } = await supabaseAdmin
        .from("party")
        .delete()
        .in("id", removeIds);

      if (delErr) {
        errors.push(`${group.name}: delete failed — ${delErr.message}`);
      } else {
        totalRemoved += removeIds.length;
      }
    } catch (e) {
      errors.push(`${group.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({
    dryRun: false,
    groups: duplicateGroups.length,
    removed: totalRemoved,
    errors: errors.length > 0 ? errors : undefined,
  });
}
