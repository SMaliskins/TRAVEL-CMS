import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function getCurrentUser(request: NextRequest) {
  let user = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) user = data.user;
  }
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (cookieHeader) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Cookie: cookieHeader } },
      });
      const { data, error } = await authClient.auth.getUser();
      if (!error && data?.user) user = data.user;
    }
  }
  return user;
}

async function getCompanyId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  return data?.company_id || null;
}

/**
 * GET /api/hotel-contact-overrides?hid=123
 * Returns override for hotel (company-scoped)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "User has no company" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const hid = searchParams.get("hid");
    if (!hid || !/^\d+$/.test(hid)) {
      return NextResponse.json({ error: "hid (hotel ID) is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("hotel_contact_overrides")
      .select("email, phone, address")
      .eq("company_id", companyId)
      .eq("hotel_hid", parseInt(hid, 10))
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Hotel contact override GET error:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    return NextResponse.json({
      data: data ? { email: data.email, phone: data.phone, address: data.address } : null,
    });
  } catch (err) {
    console.error("Hotel contact override GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/hotel-contact-overrides
 * Upsert override for hotel (company-scoped)
 * Body: { hotelHid: number, hotelName: string, email?: string, phone?: string, address?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "User has no company" }, { status: 400 });
    }

    const body = await request.json();
    const { hotelHid, hotelName, email, phone, address } = body;

    if (!hotelHid || typeof hotelHid !== "number" || hotelHid <= 0) {
      return NextResponse.json({ error: "hotelHid (number) is required" }, { status: 400 });
    }

    if (!hotelName || typeof hotelName !== "string" || !hotelName.trim()) {
      return NextResponse.json({ error: "hotelName is required" }, { status: 400 });
    }

    const payload = {
      company_id: companyId,
      hotel_hid: hotelHid,
      hotel_name: hotelName.trim(),
      email: email && typeof email === "string" ? email.trim() || null : null,
      phone: phone && typeof phone === "string" ? phone.trim() || null : null,
      address: address && typeof address === "string" ? address.trim() || null : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("hotel_contact_overrides")
      .upsert(payload, {
        onConflict: "company_id,hotel_hid",
      });

    if (error) {
      console.error("Hotel contact override POST error:", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Hotel contact override POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
