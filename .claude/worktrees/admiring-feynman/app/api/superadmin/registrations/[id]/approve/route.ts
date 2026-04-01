import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email/sendEmail";
import { buildWelcomeEmail } from "@/lib/notifications/welcomeEmail";

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

    // 3. Get roles — find a valid fallback
    const { data: roles } = await supabaseAdmin
      .from("roles")
      .select("id, name");

    const roleMap: Record<string, string> = {};
    (roles || []).forEach((r) => {
      roleMap[r.name.toLowerCase()] = r.id;
    });

    const fallbackRoleId =
      roleMap["supervisor"] || roleMap["manager"] || roleMap["agent"] || (roles && roles[0]?.id) || null;

    if (!fallbackRoleId) {
      console.error("[Approve] No roles found in database");
      return NextResponse.json(
        { error: "No roles configured in the system. Please create roles first." },
        { status: 500 }
      );
    }

    // 4. Create users
    const createdUsers: { email: string; tempPassword: string }[] = [];
    const userErrors: string[] = [];

    for (const userData of usersData) {
      const tempPassword = generateTempPassword();

      // Create auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: tempPassword,
        email_confirm: true,
      });

      if (authError || !authUser.user) {
        console.error("[Approve] User creation error:", authError);
        userErrors.push(`Auth user ${userData.email}: ${authError?.message || "unknown error"}`);
        continue;
      }

      // Determine role — first user gets supervisor, rest get their requested role
      const isFirstUser = createdUsers.length === 0;
      const roleName = isFirstUser ? "supervisor" : (userData.role?.toLowerCase() || "agent");
      const roleId = roleMap[roleName] || fallbackRoleId;

      // Create user_profiles
      const { error: profileError } = await supabaseAdmin.from("user_profiles").insert({
        id: authUser.user.id,
        company_id: company.id,
        role_id: roleId,
        first_name: userData.name?.split(" ")[0] || "",
        last_name: userData.name?.split(" ").slice(1).join(" ") || "",
        is_active: true,
      });

      if (profileError) {
        console.error("[Approve] Profile creation error:", profileError);
        userErrors.push(`Profile ${userData.email}: ${profileError.message}`);
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        continue;
      }

      // Create company_users mapping (for login routing)
      const { error: companyUserError } = await supabaseAdmin.from("company_users").insert({
        email: userData.email.toLowerCase().trim(),
        company_id: company.id,
      });

      if (companyUserError) {
        console.error("[Approve] company_users insert error:", companyUserError);
      }

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

    // Send welcome emails with temporary passwords
    const loginUrl = `${request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://app.travel-cms.com"}/login`;
    const emailResults: { email: string; sent: boolean }[] = [];

    for (const user of createdUsers) {
      const userName = usersData.find((u) => u.email === user.email)?.name || user.email;
      const { subject, html, text } = buildWelcomeEmail({
        userName,
        email: user.email,
        tempPassword: user.tempPassword,
        companyName: companyData.name,
        loginUrl,
      });
      const result = await sendEmail(user.email, subject, html, text);
      emailResults.push({ email: user.email, sent: result.success });
    }

    return NextResponse.json({
      success: true,
      companyId: company.id,
      usersCreated: createdUsers.length,
      emailsSent: emailResults.filter((e) => e.sent).length,
      emailResults,
      users: createdUsers,
      ...(userErrors.length > 0 ? { warnings: userErrors } : {}),
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
