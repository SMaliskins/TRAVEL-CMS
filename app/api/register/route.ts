import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface UserData {
  name: string;
  email: string;
  role: string;
}

interface CompanyData {
  name: string;
  legal_name?: string;
  country?: string;
  email: string;
  phone?: string;
}

/**
 * POST /api/register - Submit company registration
 * 
 * Creates a registration request that needs SuperAdmin approval.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company, plan, users } = body as {
      company: CompanyData;
      plan: string;
      users: UserData[];
    };

    // Validate
    if (!company?.name || !company?.email) {
      return NextResponse.json(
        { error: "Company name and email are required" },
        { status: 400 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: "At least one user is required" },
        { status: 400 }
      );
    }

    const hasSupervisor = users.some((u) => u.role === "supervisor" && u.email);
    if (!hasSupervisor) {
      return NextResponse.json(
        { error: "At least one Supervisor is required" },
        { status: 400 }
      );
    }

    // Get plan ID
    let planId: string | null = null;
    if (plan) {
      const { data: planData } = await supabaseAdmin
        .from("subscription_plans")
        .select("id")
        .ilike("name", plan)
        .single();
      planId = planData?.id || null;
    }

    // Check if company email already registered
    const { data: existingReg } = await supabaseAdmin
      .from("company_registrations")
      .select("id")
      .eq("status", "pending")
      .contains("company_data", { email: company.email })
      .single();

    if (existingReg) {
      return NextResponse.json(
        { error: "A registration with this email is already pending" },
        { status: 400 }
      );
    }

    // Create registration request
    const { data: registration, error } = await supabaseAdmin
      .from("company_registrations")
      .insert({
        status: "pending",
        company_data: company,
        users_data: users,
        selected_plan_id: planId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Register] Error:", error);
      return NextResponse.json(
        { error: "Failed to submit registration" },
        { status: 500 }
      );
    }

    // TODO: Send notification to SuperAdmin
    // TODO: Send confirmation email to company

    return NextResponse.json({
      success: true,
      registrationId: registration.id,
      message: "Registration submitted. You will receive an email once approved.",
    });
  } catch (err) {
    console.error("[Register] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
