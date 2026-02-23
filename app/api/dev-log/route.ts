import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }
  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: cookieHeader } },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) return data.user;
  }
  return null;
}

async function getUserProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("company_id, display_name")
    .eq("user_id", userId)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getUserProfile(user.id);
    if (!profile?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("dev_log")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[dev-log] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("[dev-log] GET:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      console.error("[dev-log] POST: no authenticated user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getUserProfile(user.id);
    if (!profile?.company_id) {
      console.error("[dev-log] POST: no company_id for user", user.id);
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("screenshot") as File | null;
    const comment = formData.get("comment") as string || "";
    const pageUrl = formData.get("page_url") as string || "";

    let screenshotUrl: string | null = null;

    if (file && file.size > 0) {
      const ext = file.name.split(".").pop() || "png";
      const filename = `report-${randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from("dev-log")
        .upload(filename, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("[dev-log] Upload error:", uploadError);
      } else {
        const { data: urlData } = supabaseAdmin.storage
          .from("dev-log")
          .getPublicUrl(filename);
        screenshotUrl = urlData.publicUrl;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("dev_log")
      .insert({
        company_id: profile.company_id,
        reported_by: user.id,
        reporter_name: profile.display_name || user.email || "Unknown",
        page_url: pageUrl,
        comment,
        screenshot_url: screenshotUrl,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("[dev-log] INSERT error:", error);
      return NextResponse.json({ error: `Failed to create report: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[dev-log] POST:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
