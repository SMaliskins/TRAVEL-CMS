import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Get current user from session
 */
async function getCurrentUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only in API routes
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

/**
 * GET /api/profile — Get current user's profile
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

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
        is_active,
        created_at,
        last_login_at,
        role:roles(id, name, display_name, display_name_en, level, color),
        company:companies(id, name)
      `)
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      console.error("Error fetching profile:", error);
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
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
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, phone } = body;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone || null;

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
        is_active,
        created_at,
        updated_at,
        role:roles(id, name, display_name, level, color),
        company:companies(id, name)
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
