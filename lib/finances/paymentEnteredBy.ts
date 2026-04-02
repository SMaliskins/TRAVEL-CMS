import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Attach `entered_by_name` from `user_profiles` for each row's `created_by`. */
export async function enrichPaymentsWithEnteredBy(
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const creatorIds = [
    ...new Set(
      rows
        .map((r) => (typeof r.created_by === "string" ? r.created_by : null))
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const profileMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from("user_profiles")
      .select("id, first_name, last_name")
      .in("id", creatorIds);
    for (const pr of profs ?? []) {
      const row = pr as { id: string; first_name: string | null; last_name: string | null };
      const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
      profileMap.set(row.id, name || "—");
    }
  }
  return rows.map((p) => {
    const cid = typeof p.created_by === "string" ? p.created_by : null;
    return {
      ...p,
      entered_by_name: cid ? profileMap.get(cid) ?? null : null,
    };
  });
}
