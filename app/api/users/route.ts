import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROLES, hasMinimumRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/**
 * Generate a random temporary password
 */
function generateTempPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Get current user from request
 */
async function getCurrentUser(request: NextRequest) {
  // Try Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) {
      return data.user;
    }
  }

  // Try cookies
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
 * GET /api/users — List users in company (Supervisor/Manager only)
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserWithRole(request);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role: manager (level 4) or supervisor (level 5)
    const roleName = currentUser.role?.name || "";
    if (!hasMinimumRole(roleName, ROLES.MANAGER)) {
      return NextResponse.json(
        { error: "Forbidden: Manager or Supervisor role required" },
        { status: 403 }
      );
    }

    // Get all users in company
    const { data: users, error } = await supabaseAdmin
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
        role:roles(id, name, display_name, display_name_en, level, color)
      `)
      .eq("company_id", currentUser.companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users", details: error.message },
        { status: 500 }
      );
    }

    // Get email addresses from auth.users
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    
    // Map emails to user profiles
    const emailMap = new Map<string, string>();
    const lastSignInMap = new Map<string, string | null>();
    authUsers?.users?.forEach((au) => {
      emailMap.set(au.id, au.email || "");
      lastSignInMap.set(au.id, au.last_sign_in_at || null);
    });

    const usersWithEmail = users.map((user) => ({
      ...user,
      email: emailMap.get(user.id) || "",
      last_sign_in_at: lastSignInMap.get(user.id) || null,
    }));

    return NextResponse.json(usersWithEmail);
  } catch (error) {
    console.error("Users API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users — Create new user (Supervisor only)
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserWithRole(request);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Supervisor can create users
    const roleName = currentUser.role?.name || "";
    if (roleName !== ROLES.SUPERVISOR) {
      return NextResponse.json(
        { error: "Forbidden: Only Supervisor can create users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, firstName, lastName, phone, roleId } = body;

    // Validate required fields
    if (!email || !firstName || !lastName || !roleId) {
      return NextResponse.json(
        { error: "Missing required fields: email, firstName, lastName, roleId" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Verify role exists
    const { data: role, error: roleError } = await supabaseAdmin
      .from("roles")
      .select("id, name, level")
      .eq("id", roleId)
      .eq("is_active", true)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { error: "Invalid role ID" },
        { status: 400 }
      );
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      
      if (authError.message.includes("already been registered")) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to create user", details: authError.message },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user: No user returned" },
        { status: 500 }
      );
    }

    // Create user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        id: authData.user.id,
        company_id: currentUser.companyId,
        role_id: roleId,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        is_active: true,
        created_by: currentUser.id,
      })
      .select(`
        id,
        first_name,
        last_name,
        phone,
        avatar_url,
        is_active,
        created_at,
        role:roles(id, name, display_name, level, color)
      `)
      .single();

    if (profileError) {
      console.error("Error creating user profile:", profileError);
      
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return NextResponse.json(
        { error: "Failed to create user profile", details: profileError.message },
        { status: 500 }
      );
    }

    // Return created user with temporary password (shown once)
    return NextResponse.json({
      user: {
        ...profile,
        email,
      },
      tempPassword,
      message: "User created successfully. Save the temporary password - it will not be shown again.",
    }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
