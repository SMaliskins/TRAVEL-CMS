import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/roles
 * Returns all active roles with their permissions
 */
export async function GET() {
  try {
    // Get all active roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("roles")
      .select(`
        id,
        name,
        display_name,
        display_name_en,
        level,
        scope,
        color,
        description,
        is_system
      `)
      .eq("is_active", true)
      .order("level", { ascending: true });

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
      return NextResponse.json(
        { error: "Failed to fetch roles", details: rolesError.message },
        { status: 500 }
      );
    }

    // Get permissions for each role
    const { data: permissions, error: permError } = await supabaseAdmin
      .from("role_permissions")
      .select("role_id, permission, scope");

    if (permError) {
      console.error("Error fetching permissions:", permError);
      // Return roles without permissions if error
      return NextResponse.json(roles);
    }

    // Merge permissions into roles
    const rolesWithPermissions = roles.map((role) => ({
      ...role,
      permissions: permissions
        ?.filter((p) => p.role_id === role.id)
        .map((p) => ({ permission: p.permission, scope: p.scope })) || [],
    }));

    return NextResponse.json(rolesWithPermissions);
  } catch (error) {
    console.error("Roles API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
