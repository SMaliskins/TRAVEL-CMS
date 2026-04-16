import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptSecret } from "@/lib/security/secrets";

function normalizeSupabaseOrigin(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return s.replace(/\/$/, "").toLowerCase();
  }
}

/**
 * GET /api/auth/public-anon-key?supabaseUrl=https://xxx.supabase.co
 * Returns the public anon key for the central project or a registered company dedicated project.
 * Anon keys are already public in the browser; this only maps host → key for password-recovery UX.
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("supabaseUrl");
    if (!raw) {
      return NextResponse.json({ error: "supabaseUrl is required" }, { status: 400 });
    }

    const requested = normalizeSupabaseOrigin(raw);
    const central = normalizeSupabaseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    if (requested && central && requested === central) {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!anonKey) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
      }
      return NextResponse.json({ anonKey });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from("companies")
      .select(
        "supabase_url, supabase_anon_key, supabase_anon_key_ciphertext, supabase_status, supabase_configured"
      )
      .eq("supabase_status", "active");

    if (error) {
      console.error("[public-anon-key] companies:", error.message);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }

    for (const row of rows || []) {
      if (!(row as { supabase_configured?: boolean }).supabase_configured) continue;
      const u = row.supabase_url as string | null;
      if (!u) continue;
      if (normalizeSupabaseOrigin(u) !== requested) continue;
      const anonKey =
        decryptSecret(row.supabase_anon_key_ciphertext as string | null | undefined) ||
        (row.supabase_anon_key as string | null);
      if (anonKey) {
        return NextResponse.json({ anonKey });
      }
    }

    return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  } catch (e) {
    console.error("[public-anon-key]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
