import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

/**
 * GET /api/directory/duplicates
 * Returns groups of parties with the same display_name for manual review.
 * Each group has parties sorted by "completeness" (avatar, orders, passport, email).
 */
export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allParties: Array<{
    id: string; display_name: string; display_id: number;
    party_type: string; email: string | null; phone: string | null;
  }> = [];

  const PAGE_SIZE = 1000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("party")
      .select("id, display_name, display_id, party_type, email, phone")
      .eq("company_id", auth.companyId)
      .eq("status", "active")
      .order("display_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    allParties.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  const personIds = allParties.filter((p) => p.party_type === "person").map((p) => p.id);

  let personMap = new Map<string, { avatar_url: string | null; dob: string | null; passport_number: string | null }>();
  if (personIds.length > 0) {
    for (let i = 0; i < personIds.length; i += PAGE_SIZE) {
      const batch = personIds.slice(i, i + PAGE_SIZE);
      const { data: persons } = await supabaseAdmin
        .from("party_person")
        .select("party_id, avatar_url, dob, passport_number")
        .in("party_id", batch);
      if (persons) {
        for (const p of persons) {
          personMap.set(p.party_id, { avatar_url: p.avatar_url, dob: p.dob, passport_number: p.passport_number });
        }
      }
    }
  }

  const { data: orderCounts } = await supabaseAdmin
    .from("orders")
    .select("client_party_id")
    .eq("company_id", auth.companyId);

  const orderCountMap = new Map<string, number>();
  if (orderCounts) {
    for (const o of orderCounts) {
      orderCountMap.set(o.client_party_id, (orderCountMap.get(o.client_party_id) || 0) + 1);
    }
  }

  const groups = new Map<string, typeof allParties>();
  for (const p of allParties) {
    const key = `${(p.display_name || "").trim().toLowerCase()}|${p.party_type}`;
    const arr = groups.get(key) || [];
    arr.push(p);
    groups.set(key, arr);
  }

  const duplicateGroups: Array<{
    name: string;
    type: string;
    parties: Array<{
      id: string;
      displayId: number;
      displayName: string;
      email: string | null;
      phone: string | null;
      avatarUrl: string | null;
      hasDob: boolean;
      hasPassport: boolean;
      ordersCount: number;
    }>;
  }> = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((a, b) => {
      const aOrders = orderCountMap.get(a.id) || 0;
      const bOrders = orderCountMap.get(b.id) || 0;
      if (bOrders !== aOrders) return bOrders - aOrders;
      const aAvatar = personMap.get(a.id)?.avatar_url ? 1 : 0;
      const bAvatar = personMap.get(b.id)?.avatar_url ? 1 : 0;
      if (bAvatar !== aAvatar) return bAvatar - aAvatar;
      return (a.display_id || 0) - (b.display_id || 0);
    });

    duplicateGroups.push({
      name: sorted[0].display_name,
      type: sorted[0].party_type,
      parties: sorted.map((p) => {
        const person = personMap.get(p.id);
        return {
          id: p.id,
          displayId: p.display_id,
          displayName: p.display_name,
          email: p.email,
          phone: p.phone,
          avatarUrl: person?.avatar_url || null,
          hasDob: !!person?.dob,
          hasPassport: !!(person?.passport_number && person.passport_number.trim()),
          ordersCount: orderCountMap.get(p.id) || 0,
        };
      }),
    });
  }

  duplicateGroups.sort((a, b) => b.parties.length - a.parties.length);

  return NextResponse.json({ groups: duplicateGroups, totalGroups: duplicateGroups.length });
}
