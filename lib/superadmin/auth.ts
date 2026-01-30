import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import bcrypt from "bcryptjs";

const JWT_SECRET = new TextEncoder().encode(
  process.env.SUPERADMIN_JWT_SECRET || process.env.JWT_SECRET || "superadmin-secret-change-me"
);

const COOKIE_NAME = "superadmin_token";
const TOKEN_EXPIRY = "24h";

export interface SuperAdminPayload {
  id: string;
  email: string;
  name: string;
}

/**
 * Create a JWT token for SuperAdmin
 */
export async function createSuperAdminToken(payload: SuperAdminPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Verify SuperAdmin JWT token
 */
export async function verifySuperAdminToken(token: string): Promise<SuperAdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

/**
 * Get SuperAdmin from request (cookie or Authorization header)
 */
export async function getSuperAdminFromRequest(request: NextRequest): Promise<SuperAdminPayload | null> {
  // Try cookie first
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const payload = await verifySuperAdminToken(cookieToken);
    if (payload) return payload;
  }

  // Try Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    return await verifySuperAdminToken(token);
  }

  return null;
}

/**
 * Login SuperAdmin with email and password
 */
export async function loginSuperAdmin(
  email: string,
  password: string
): Promise<{ success: true; token: string; admin: SuperAdminPayload } | { success: false; error: string }> {
  // Fetch superadmin by email
  const { data: admin, error } = await supabaseAdmin
    .from("superadmins")
    .select("id, email, name, password_hash, is_active")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error || !admin) {
    return { success: false, error: "Invalid email or password" };
  }

  if (!admin.is_active) {
    return { success: false, error: "Account is disabled" };
  }

  // Verify password
  const isValid = await bcrypt.compare(password, admin.password_hash);
  if (!isValid) {
    return { success: false, error: "Invalid email or password" };
  }

  // Update last login
  await supabaseAdmin
    .from("superadmins")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", admin.id);

  // Create token
  const payload: SuperAdminPayload = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
  };

  const token = await createSuperAdminToken(payload);

  return { success: true, token, admin: payload };
}

/**
 * Create response with SuperAdmin cookie
 */
export function createAuthResponse(token: string, body: object): NextResponse {
  const response = NextResponse.json(body);
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });
  return response;
}

/**
 * Create logout response (clear cookie)
 */
export function createLogoutResponse(): NextResponse {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

/**
 * Hash password for new SuperAdmin
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

/**
 * Middleware helper: require SuperAdmin auth
 */
export async function requireSuperAdmin(
  request: NextRequest
): Promise<{ admin: SuperAdminPayload } | NextResponse> {
  const admin = await getSuperAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { admin };
}

/**
 * Create initial SuperAdmin (for setup)
 */
export async function createSuperAdmin(
  email: string,
  password: string,
  name: string
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const passwordHash = await hashPassword(password);

  const { data, error } = await supabaseAdmin
    .from("superadmins")
    .insert({
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      name,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Email already exists" };
    }
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}
