import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/demo/signup - Create demo account
 * 
 * Creates a demo company with sample data and sends credentials via email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, companyName } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if email already used for demo
    const { data: existing } = await supabaseAdmin
      .from("demo_signups")
      .select("id, demo_expires_at")
      .eq("email", email.toLowerCase())
      .single();

    if (existing) {
      const expiresAt = new Date(existing.demo_expires_at);
      if (expiresAt > new Date()) {
        return NextResponse.json(
          { error: "You already have an active demo. Check your email for credentials." },
          { status: 400 }
        );
      }
    }

    // Generate demo company name
    const demoCompanyName = companyName || `Demo Agency ${Date.now().toString(36).toUpperCase()}`;
    const tempPassword = generatePassword();

    // 1. Create demo company
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: demoCompanyName,
        is_demo: true,
        demo_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
      })
      .select("id")
      .single();

    if (companyError || !company) {
      console.error("[Demo Signup] Company creation error:", companyError);
      return NextResponse.json({ error: "Failed to create demo" }, { status: 500 });
    }

    // 2. Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true,
    });

    if (authError || !authUser.user) {
      // Cleanup company
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      
      if (authError?.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "This email is already registered. Please login instead." },
          { status: 400 }
        );
      }
      
      console.error("[Demo Signup] Auth error:", authError);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // 3. Get Supervisor role
    const { data: supervisorRole } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", "Supervisor")
      .single();

    // 4. Create user profile
    await supabaseAdmin.from("user_profiles").insert({
      id: authUser.user.id,
      company_id: company.id,
      role_id: supervisorRole?.id || null,
      first_name: name?.split(" ")[0] || "Demo",
      last_name: name?.split(" ").slice(1).join(" ") || "User",
      is_active: true,
    });

    // 5. Assign Free plan
    const { data: freePlan } = await supabaseAdmin
      .from("subscription_plans")
      .select("id")
      .eq("name", "Free")
      .single();

    if (freePlan) {
      await supabaseAdmin.from("company_subscriptions").insert({
        company_id: company.id,
        plan_id: freePlan.id,
        status: "trialing",
        current_period_end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // 6. Record demo signup
    await supabaseAdmin.from("demo_signups").insert({
      email: email.toLowerCase(),
      name: name || null,
      company_name: demoCompanyName,
      demo_company_id: company.id,
      demo_user_id: authUser.user.id,
      demo_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // TODO: Send welcome email with credentials
    // In production: sendDemoWelcomeEmail(email, tempPassword)
    // In development, return password so user can log in immediately
    const isDev = process.env.NODE_ENV === "development";

    console.log(`[Demo Signup] Created demo for ${email}. Temp password: ${tempPassword}`);

    return NextResponse.json({
      success: true,
      message: isDev
        ? "Demo account created! Use the credentials below to log in."
        : "Demo account created! Check your email for login credentials.",
      ...(isDev && { credentials: { email: email.toLowerCase(), password: tempPassword } }),
    });
  } catch (err) {
    console.error("[Demo Signup] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let password = "";
  for (let i = 0; i < 14; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
