import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/superadmin/companies - List all companies
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status"); // active, demo, expired
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("companies")
      .select(`
        id,
        name,
        legal_name,
        country,
        is_demo,
        demo_expires_at,
        created_at,
        company_subscriptions (
          status,
          subscription_plans (
            name,
            monthly_price_eur
          )
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,legal_name.ilike.%${search}%`);
    }

    // Status filter
    if (status === "demo") {
      query = query.eq("is_demo", true);
    } else if (status === "active") {
      query = query.eq("is_demo", false);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("[SuperAdmin Companies] Error:", error);
      return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
    }

    // Map to simpler format
    const companies = (data || []).map((c) => {
      const sub = Array.isArray(c.company_subscriptions) 
        ? c.company_subscriptions[0] 
        : c.company_subscriptions;
      const plan = sub?.subscription_plans as { name?: string; monthly_price_eur?: number } | null;
      
      return {
        id: c.id,
        name: c.name,
        legalName: c.legal_name,
        country: c.country,
        isDemo: c.is_demo,
        demoExpiresAt: c.demo_expires_at,
        createdAt: c.created_at,
        subscription: {
          status: sub?.status || (c.is_demo ? "demo" : "none"),
          planName: plan?.name || (c.is_demo ? "Demo" : "Free"),
          monthlyPrice: plan?.monthly_price_eur || 0,
        },
      };
    });

    return NextResponse.json({
      companies,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    console.error("[SuperAdmin Companies] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
