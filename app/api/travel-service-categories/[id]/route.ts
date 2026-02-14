import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }
  return null;
}

async function getCompanyId(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("id", userId)
    .single();
  return data?.company_id || null;
}

// PATCH - Update category
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const categoryId = resolvedParams.id;
    const body = await request.json();
    const { name, vat_rate, is_active, type } = body;

    // Verify category belongs to user's company
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("travel_service_categories")
      .select("company_id")
      .eq("id", categoryId)
      .single();

    if (fetchError || !existing) {
      console.error("Category fetch error:", fetchError, "categoryId:", categoryId);
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (existing.company_id !== companyId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const validTypes = ['flight', 'hotel', 'transfer', 'tour', 'insurance', 'visa', 'rent_a_car', 'cruise', 'other'];
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (vat_rate !== undefined) updateData.vat_rate = typeof vat_rate === "number" ? vat_rate : parseFloat(vat_rate) || 0;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (type !== undefined && validTypes.includes(type)) updateData.type = type;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("travel_service_categories")
      .update(updateData)
      .eq("id", categoryId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Category with this name already exists" }, { status: 400 });
      }
      console.error("Error updating category:", error);
      return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
    }

    return NextResponse.json({ category: data });
  } catch (err) {
    console.error("PATCH category error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const categoryId = resolvedParams.id;

    // Verify category belongs to user's company
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("travel_service_categories")
      .select("company_id")
      .eq("id", categoryId)
      .single();

    if (fetchError || !existing) {
      console.error("Category fetch error:", fetchError, "categoryId:", categoryId);
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (existing.company_id !== companyId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("travel_service_categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      console.error("Error deleting category:", error);
      return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE category error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
