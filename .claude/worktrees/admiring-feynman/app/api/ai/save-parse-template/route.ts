import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveTemplate } from "@/lib/flights/parseTemplates";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function getAuthInfo(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;

  const userId = data.user.id;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (!profile?.company_id) return null;
  return { userId, companyId: profile.company_id };
}

export async function POST(request: NextRequest) {
  try {
    const authInfo = await getAuthInfo(request);
    if (!authInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { text, segments, booking } = body;

    if (!text || typeof text !== "string" || !segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "text and segments[] are required" }, { status: 400 });
    }

    await saveTemplate(
      text,
      { segments: segments.slice(0, 6), booking: booking || {} },
      "manual",
      authInfo.companyId
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Save parse template error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
