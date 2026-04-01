import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptSecret } from "@/lib/security/secrets";

/**
 * POST /api/auth/resolve-company
 * Looks up which company (and Supabase project) a user belongs to, based on their email.
 * Returns the company's Supabase URL + anon key if they have a dedicated DB.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const { data: mapping } = await supabaseAdmin
    .from("company_users")
    .select("company_id")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (!mapping) {
    return NextResponse.json({
      dedicated: false,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  }

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("supabase_configured, supabase_url, supabase_anon_key, supabase_anon_key_ciphertext, supabase_status")
    .eq("id", mapping.company_id)
    .single();

  const anonKey = decryptSecret(company?.supabase_anon_key_ciphertext) || company?.supabase_anon_key;

  if (
    company?.supabase_configured &&
    company.supabase_status === "active" &&
    company.supabase_url &&
    anonKey
  ) {
    return NextResponse.json({
      dedicated: true,
      supabaseUrl: company.supabase_url,
      supabaseAnonKey: anonKey,
    });
  }

  if (company?.supabase_status === "paused") {
    return NextResponse.json({
      dedicated: false,
      suspended: true,
      message: "Your account has been suspended. Please contact your administrator.",
    });
  }

  return NextResponse.json({
    dedicated: false,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
