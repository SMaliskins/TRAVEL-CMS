import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { data, error } = await supabaseAdmin
      .from("plan_addons")
      .select("*")
      .order("sort_order");

    if (error) throw error;
    return NextResponse.json({ addons: data || [] });
  } catch (err) {
    console.error("[SuperAdmin Addons GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { name, slug, description, price_monthly, category, unit_label } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("plan_addons")
      .insert({
        name,
        slug,
        description: description || "",
        price_monthly: price_monthly || 0,
        category: category || "feature",
        unit_label: unit_label || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `Add-on with slug "${slug}" already exists` }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ addon: data }, { status: 201 });
  } catch (err) {
    console.error("[SuperAdmin Addons POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const allowed = ["name", "slug", "description", "price_monthly", "category", "unit_label", "is_active", "sort_order"];
    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) filtered[key] = updates[key];
    }

    const { data, error } = await supabaseAdmin
      .from("plan_addons")
      .update(filtered)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ addon: data });
  } catch (err) {
    console.error("[SuperAdmin Addons PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
