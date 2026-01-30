import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface UserData {
  email: string;
  name: string;
  role: string;
}

interface CompanyData {
  name: string;
  legal_name?: string;
  registration_number?: string;
  vat_number?: string;
  country?: string;
  address?: string;
  email?: string;
  phone?: string;
}

/**
 * POST /api/superadmin/registrations/[id]/approve - Approve registration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { admin } = authResult;
  const { id } = await params;

  try {
    // Get registration
    const { data: registration, error: fetchError } = await supabaseAdmin
      .from("company_registrations")
      .select("*")
      .eq("id", id)
      .eq("status", "pending")
      .single();

    if (fetchError || !registration) {
      return NextResponse.json(
        { error: "Registration not found or already processed" },
        { status: 404 }
      );
    }

    const companyData = registration.company_data as CompanyData;
    const usersData = registration.users_data as UserData[];

    // 1. Create company
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: companyData.name,
        legal_name: companyData.legal_name || null,
        registration_number: companyData.registration_number || null,
        vat_number: companyData.vat_number || null,
        country: companyData.country || null,
        operating_address: companyData.address || null,
      })
      .select("id")
      .single();

    if (companyError || !company) {
      console.error("[Approve] Company creation error:", companyError);
      return NextResponse.json(
        { error: "Failed to create company" },
        { status: 500 }
      );
    }

    // 2. Create subscription (Free plan if no plan selected)
    if (registration.selected_plan_id) {
      await supabaseAdmin.from("company_subscriptions").insert({
        company_id: company.id,
        plan_id: registration.selected_plan_id,
        status: "active",
      });
    } else {
      // Get Free plan
      const { data: freePlan } = await supabaseAdmin
        .from("subscription_plans")
        .select("id")
        .eq("name", "Free")
        .single();

      if (freePlan) {
        await supabaseAdmin.from("company_subscriptions").insert({
          company_id: company.id,
          plan_id: freePlan.id,
          status: "active",
        });
      }
    }

    // 3. Get roles
    const { data: roles } = await supabaseAdmin
      .from("roles")
      .select("id, name");

    const roleMap: Record<string, string> = {};
    (roles || []).forEach((r) => {
      roleMap[r.name.toLowerCase()] = r.id;
    });

    // 4. Create users
    const createdUsers: { email: string; tempPassword: string }[] = [];

    for (const userData of usersData) {
      // Generate temporary password
      const tempPassword = generateTempPassword();

      // Create auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: tempPassword,
        email_confirm: true,
      });

      if (authError || !authUser.user) {
        console.error("[Approve] User creation error:", authError);
        continue;
      }

      // Determine role
      const roleName = userData.role?.toLowerCase() || "agent";
      const roleId = roleMap[roleName] || roleMap["agent"];

      // Create profile
      await supabaseAdmin.from("user_profiles").insert({
        id: authUser.user.id,
        company_id: company.id,
        role_id: roleId,
        first_name: userData.name?.split(" ")[0] || "",
        last_name: userData.name?.split(" ").slice(1).join(" ") || "",
        is_active: true,
      });

      createdUsers.push({
        email: userData.email,
        tempPassword,
      });
    }

    // 5. Update registration status
    await supabaseAdmin
      .from("company_registrations")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
        created_company_id: company.id,
      })
      .eq("id", id);

    // TODO: Send welcome emails with temporary passwords

    return NextResponse.json({
      success: true,
      companyId: company.id,
      usersCreated: createdUsers.length,
      // In production, don't return passwords - send via email instead
      users: createdUsers,
    });
  } catch (err) {
    console.error("[Approve Registration] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
