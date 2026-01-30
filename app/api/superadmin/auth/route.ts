import { NextRequest, NextResponse } from "next/server";
import {
  loginSuperAdmin,
  createAuthResponse,
  createLogoutResponse,
  getSuperAdminFromRequest,
} from "@/lib/superadmin/auth";

/**
 * POST /api/superadmin/auth - Login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const result = await loginSuperAdmin(email, password);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return createAuthResponse(result.token, {
      success: true,
      admin: result.admin,
    });
  } catch (err) {
    console.error("[SuperAdmin Auth] Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/superadmin/auth - Get current admin
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(request);

    if (!admin) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      admin,
    });
  } catch (err) {
    console.error("[SuperAdmin Auth] Get admin error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/superadmin/auth - Logout
 */
export async function DELETE() {
  return createLogoutResponse();
}
