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

// GET - List all categories for current company
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

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
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

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
