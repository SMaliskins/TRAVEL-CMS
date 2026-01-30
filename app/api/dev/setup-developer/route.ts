import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEVELOPER_EMAIL = "sm@gtr.lv";
const DEVELOPER_PASSWORD = "DevPass123!";

/**
 * POST /api/dev/setup-developer
 *
 * Creates or updates sm@gtr.lv with Supervisor role (full access).
 * Only available in development.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 403 });
  }

  try {
    // 1. Get or create company
    let { data: company } = await supabaseAdmin
      .from("companies")
      .select("id")
      .limit(1)
      .single();

    if (!company) {
      const { data: newCompany, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert({
          name: "Developer Company",
          is_demo: false,
        })
        .select("id")
        .single();

      if (companyError || !newCompany) {
        return NextResponse.json(
          { error: "Failed to create company", details: companyError?.message },
          { status: 500 }
        );
      }
      company = newCompany;
    }

    // 2. Create or update user
    let userId: string;

    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: DEVELOPER_EMAIL,
      password: DEVELOPER_PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
        // User exists - find and update password
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
        const authUser = listData?.users?.find((u) => u.email?.toLowerCase() === DEVELOPER_EMAIL.toLowerCase());
        if (!authUser) {
          return NextResponse.json(
            { error: "User exists but could not be found. Try resetting password in Supabase Dashboard." },
            { status: 500 }
          );
        }
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password: DEVELOPER_PASSWORD,
        });
        userId = authUser.id;
      } else {
        return NextResponse.json(
          { error: "Failed to create user", details: authError.message },
          { status: 500 }
        );
      }
    } else if (newAuthUser?.user) {
      userId = newAuthUser.user.id;
    } else {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // 3. Get Supervisor role
    const { data: supervisorRole } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", "supervisor")
      .single();

    // 4. Upsert user_profiles
    const { error: profileError } = await supabaseAdmin.from("user_profiles").upsert(
      {
        id: userId,
        company_id: company.id,
        role_id: supervisorRole?.id || null,
        first_name: "Sergejs",
        last_name: "Developer",
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to update profile", details: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Developer account ready",
      credentials: {
        email: DEVELOPER_EMAIL,
        password: DEVELOPER_PASSWORD,
      },
      loginUrl: "/login",
    });
  } catch (err) {
    console.error("[Setup Developer] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
