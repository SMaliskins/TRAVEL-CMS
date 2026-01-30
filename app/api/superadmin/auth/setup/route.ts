import { NextRequest, NextResponse } from "next/server";
import { createSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/superadmin/auth/setup - Create initial SuperAdmin
 * 
 * This endpoint only works when there are no superadmins in the database.
 * Used for initial setup only.
 */
export async function POST(request: NextRequest) {
  try {
    // Check if any superadmin exists
    const { count, error: countError } = await supabaseAdmin
      .from("superadmins")
      .select("id", { count: "exact", head: true });

    if (countError) {
      console.error("[SuperAdmin Setup] Count error:", countError);
      return NextResponse.json(
        { error: "Database error. Make sure to run the migration first." },
        { status: 500 }
      );
    }

    if (count && count > 0) {
      return NextResponse.json(
        { error: "Setup already completed. SuperAdmin already exists." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const result = await createSuperAdmin(email, password, name);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "SuperAdmin created successfully. You can now login at /superadmin/login",
      id: result.id,
    });
  } catch (err) {
    console.error("[SuperAdmin Setup] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
