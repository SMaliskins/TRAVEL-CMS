import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { data, error } = await supabaseAdmin
      .from("tariff_plans")
      .select("*")
      .order("sort_order");

    if (error) throw error;
    return NextResponse.json({ plans: data || [] });
  } catch (err) {
    console.error("[SuperAdmin Plans GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { name, slug, description, price_monthly, price_yearly, storage_limit_gb, db_limit_gb, orders_limit, users_limit, features } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("tariff_plans")
      .insert({
        name,
        slug,
        description: description || "",
        price_monthly: price_monthly || 0,
        price_yearly: price_yearly || 0,
        storage_limit_gb: storage_limit_gb || 0.5,
        db_limit_gb: db_limit_gb || 0.5,
        orders_limit: orders_limit || null,
        users_limit: users_limit || null,
        features: features || {},
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `Plan with slug "${slug}" already exists` }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ plan: data }, { status: 201 });
  } catch (err) {
    console.error("[SuperAdmin Plans POST]", err);
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

    const allowed = [
      "name", "slug", "description", "price_monthly", "price_yearly",
      "storage_limit_gb", "db_limit_gb", "orders_limit", "users_limit",
      "features", "is_active", "sort_order",
    ];
    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) filtered[key] = updates[key];
    }
    filtered.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("tariff_plans")
      .update(filtered)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ plan: data });
  } catch (err) {
    console.error("[SuperAdmin Plans PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
