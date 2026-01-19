import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROLES, hasMinimumRole } from "@/lib/auth/roles";

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
 * Get user with role from profile
 */
async function getCurrentUserWithRole(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select(`
      id,
      company_id,
      first_name,
      last_name,
      role:roles(id, name, level)
    `)
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  // Handle role as single object (Supabase may return array for join)
  const role = Array.isArray(profile.role) ? profile.role[0] : profile.role;

  return {
    id: user.id,
    email: user.email,
    companyId: profile.company_id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    role: role as { id: string; name: string; level: number } | null,
  };
}

/**
 * GET /api/users/:userId — Get user details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const currentUser = await getCurrentUserWithRole(request);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roleName = currentUser.role?.name || "";
    if (!hasMinimumRole(roleName, ROLES.MANAGER)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { data: user, error } = await supabaseAdmin
      .from("user_profiles")
      .select(`
        id,
        first_name,
        last_name,
        phone,
        is_active,
        created_at,
        last_login_at,
        role:roles(id, name, display_name, display_name_en, level, color)
      `)
      .eq("id", userId)
      .eq("company_id", currentUser.companyId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get email from auth
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);

    return NextResponse.json({
      ...user,
      email: authData?.user?.email || "",
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/:userId — Update user
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const currentUser = await getCurrentUserWithRole(request);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Supervisor can update users
    const roleName = currentUser.role?.name || "";
    if (roleName !== ROLES.SUPERVISOR) {
      return NextResponse.json(
        { error: "Forbidden: Only Supervisor can update users" },
        { status: 403 }
      );
    }

    // Verify user belongs to same company
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, role_id, is_active, role:roles(name)")
      .eq("id", userId)
      .eq("company_id", currentUser.companyId)
      .single();

    if (userError || !existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Handle role as single object
    const existingRole = Array.isArray(existingUser.role) ? existingUser.role[0] : existingUser.role;

    const body = await request.json();
    const { firstName, lastName, phone, avatarUrl, roleId, isActive } = body;

    // Security checks
    const isSelf = userId === currentUser.id;

    // Supervisor cannot deactivate themselves
    if (isSelf && isActive === false) {
      return NextResponse.json(
        { error: "Cannot deactivate yourself" },
        { status: 400 }
      );
    }

    // If changing role, verify new role
    if (roleId && roleId !== existingUser.role_id) {
      // Supervisor cannot demote themselves
      if (isSelf) {
        const { data: newRole } = await supabaseAdmin
          .from("roles")
          .select("level")
          .eq("id", roleId)
          .single();

        if (newRole && newRole.level < (currentUser.role?.level || 0)) {
          return NextResponse.json(
            { error: "Cannot demote yourself" },
            { status: 400 }
          );
        }
      }
    }

    // If deactivating a supervisor, check there's at least one other active supervisor
    if (isActive === false && existingRole?.name === ROLES.SUPERVISOR) {
      const { count } = await supabaseAdmin
        .from("user_profiles")
        .select("id", { count: "exact" })
        .eq("company_id", currentUser.companyId)
        .eq("is_active", true)
        .neq("id", userId)
        .eq("role_id", existingUser.role_id);

      if (!count || count === 0) {
        return NextResponse.json(
          { error: "Cannot deactivate the last Supervisor" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone || null;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl || null;
    if (roleId !== undefined) updateData.role_id = roleId;
    if (isActive !== undefined) updateData.is_active = isActive;

    // Update user profile
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update(updateData)
      .eq("id", userId)
      .select(`
        id,
        first_name,
        last_name,
        phone,
        is_active,
        created_at,
        updated_at,
        role:roles(id, name, display_name, level, color)
      `)
      .single();

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json(
        { error: "Failed to update user", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/:userId — Soft delete (deactivate) user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const currentUser = await getCurrentUserWithRole(request);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roleName = currentUser.role?.name || "";
    if (roleName !== ROLES.SUPERVISOR) {
      return NextResponse.json(
        { error: "Forbidden: Only Supervisor can delete users" },
        { status: 403 }
      );
    }

    // Cannot delete self
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "Cannot delete yourself" },
        { status: 400 }
      );
    }

    // Verify user belongs to same company
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, role:roles(name)")
      .eq("id", userId)
      .eq("company_id", currentUser.companyId)
      .single();

    if (userError || !existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Handle role as single object
    const existingRoleDelete = Array.isArray(existingUser.role) ? existingUser.role[0] : existingUser.role;

    // If deleting a supervisor, check there's at least one other active supervisor
    if (existingRoleDelete?.name === ROLES.SUPERVISOR) {
      const { data: supervisorRole } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("name", ROLES.SUPERVISOR)
        .single();

      if (supervisorRole) {
        const { count: supervisorCount } = await supabaseAdmin
          .from("user_profiles")
          .select("id", { count: "exact" })
          .eq("company_id", currentUser.companyId)
          .eq("is_active", true)
          .eq("role_id", supervisorRole.id)
          .neq("id", userId);

        if (!supervisorCount || supervisorCount === 0) {
          return NextResponse.json(
            { error: "Cannot delete the last Supervisor" },
            { status: 400 }
          );
        }
      }
    }

    // Soft delete: set is_active = false
    const { error: deleteError } = await supabaseAdmin
      .from("user_profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "User deactivated" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
