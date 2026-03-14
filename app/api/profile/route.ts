import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/**
 * Get current user from request
 */
async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) {
      return data.user;
    }
  }

  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: cookieHeader } },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) {
      return data.user;
    }
  }

  return null;
}

/**
 * GET /api/profile — Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile with role and company
    const { data: profile, error } = await supabaseAdmin
      .from("user_profiles")
      .select(`
        id,
        first_name,
        last_name,
        phone,
        avatar_url,
        email_signature,
        is_active,
        created_at,
        last_login_at,
        role:roles(id, name, display_name, display_name_en, level, color),
        company:companies(id, name, trading_name, legal_name)
      `)
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      // Auto-provision: find company from old profiles table or approved registration
      let companyId: string | null = null;

      const { data: oldProfile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (oldProfile?.company_id) {
        companyId = oldProfile.company_id;
      } else if (user.email) {
        const { data: regs } = await supabaseAdmin
          .from("company_registrations")
          .select("users_data, created_company_id")
          .eq("status", "approved")
          .not("created_company_id", "is", null)
          .order("reviewed_at", { ascending: false })
          .limit(20);

        if (regs) {
          for (const reg of regs) {
            const users = (reg.users_data as { email?: string }[]) || [];
            if (users.some((u) => u.email?.toLowerCase() === user.email?.toLowerCase())) {
              companyId = reg.created_company_id as string;
              break;
            }
          }
        }

        if (!companyId) {
          const { data: firstCompany } = await supabaseAdmin
            .from("companies")
            .select("id")
            .order("created_at", { ascending: true })
            .limit(1)
            .single();
          companyId = firstCompany?.id || null;
        }
      }

      if (!companyId) {
        console.error("Cannot auto-create profile: no company found for user", user.id);
        return NextResponse.json(
          { error: "Profile not found. No company associated with this account. Please contact administrator." },
          { status: 404 }
        );
      }

      const { data: defaultRole } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("name", "supervisor")
        .single();

      const { data: newProfile, error: createError } = await supabaseAdmin
        .from("user_profiles")
        .insert({
          id: user.id,
          company_id: companyId,
          first_name: user.user_metadata?.first_name || user.email?.split("@")[0] || "",
          last_name: user.user_metadata?.last_name || "",
          role_id: defaultRole?.id || null,
          is_active: true,
        })
        .select(`
          id, first_name, last_name, phone, avatar_url, email_signature,
          is_active, created_at, last_login_at,
          role:roles(id, name, display_name, display_name_en, level, color),
          company:companies(id, name, trading_name, legal_name)
        `)
        .single();

      if (createError || !newProfile) {
        console.error("Error auto-creating profile:", createError);
        return NextResponse.json(
          { error: "Profile not found and could not be created", details: createError?.message },
          { status: 404 }
        );
      }

      console.log("[Profile] Auto-created profile for user", user.id, "company", companyId);

      return NextResponse.json({
        ...newProfile,
        email: user.email,
      });
    }

    return NextResponse.json({
      ...profile,
      email: user.email,
    });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile — Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, phone, avatar_url, email_signature } = body;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone || null;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (email_signature !== undefined) updateData.email_signature = email_signature;

    // Update profile
    const { data: updated, error } = await supabaseAdmin
      .from("user_profiles")
      .update(updateData)
      .eq("id", user.id)
      .select(`
        id,
        first_name,
        last_name,
        phone,
        avatar_url,
        email_signature,
        is_active,
        created_at,
        updated_at,
        role:roles(id, name, display_name, level, color),
        company:companies(id, name, trading_name, legal_name)
      `)
      .single();

    if (error) {
      console.error("Error updating profile:", error);
      return NextResponse.json(
        { error: "Failed to update profile", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...updated,
      email: user.email,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
