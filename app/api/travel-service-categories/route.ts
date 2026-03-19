import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

// GET - List all categories for current company
export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const { data, error } = await supabaseAdmin
      .from("travel_service_categories")
      .select("*")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }

    return NextResponse.json({ categories: data || [] });
  } catch (err) {
    console.error("GET categories error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create new category
export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const body = await request.json();
    const { name, vat_rate, type } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    // Validate type - must be one of the allowed functional types
    const validTypes = ['flight', 'hotel', 'transfer', 'tour', 'insurance', 'visa', 'rent_a_car', 'cruise', 'other'];
    const categoryType = validTypes.includes(type) ? type : 'other';

    const vatRate = typeof vat_rate === "number" ? vat_rate : parseFloat(vat_rate) || 0;

    const { data, error } = await supabaseAdmin
      .from("travel_service_categories")
      .insert({
        company_id: companyId,
        name: name.trim(),
        vat_rate: vatRate,
        type: categoryType,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Category with this name already exists" }, { status: 400 });
      }
      console.error("Error creating category:", error);
      return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
    }

    return NextResponse.json({ category: data }, { status: 201 });
  } catch (err) {
    console.error("POST category error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
