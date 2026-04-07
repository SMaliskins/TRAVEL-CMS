import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { hashToken } from "@/lib/client-auth/jwt";

/**
 * Agent sets or resets the client app / referral portal password for a party.
 * Creates client_profiles if missing; requires Client role and email on party.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser?.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: partyId } = await params;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!partyId || !uuidRegex.test(partyId)) {
      return NextResponse.json({ error: "Invalid party ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const password =
      body && typeof body === "object" && typeof (body as { password?: unknown }).password === "string"
        ? (body as { password: string }).password
        : null;
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const { data: party, error: partyErr } = await supabaseAdmin
      .from("party")
      .select("id, company_id, email")
      .eq("id", partyId)
      .single();

    if (partyErr || !party) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (party.company_id !== apiUser.companyId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const emailRaw = String(party.email ?? "").trim();
    if (!emailRaw) {
      return NextResponse.json(
        { error: "EMAIL_REQUIRED", message: "Party must have an email to use the client app." },
        { status: 400 }
      );
    }

    const emailNormalized = emailRaw.toLowerCase();
    if (emailRaw !== emailNormalized) {
      const { error: normErr } = await supabaseAdmin
        .from("party")
        .update({ email: emailNormalized })
        .eq("id", partyId);
      if (normErr) {
        console.warn("[client-app-password] normalize party.email:", normErr.message);
      }
    }

    const { data: clientRow } = await supabaseAdmin
      .from("client_party")
      .select("party_id")
      .eq("party_id", partyId)
      .maybeSingle();

    const { data: refRow } = await supabaseAdmin
      .from("referral_party")
      .select("party_id")
      .eq("party_id", partyId)
      .eq("company_id", apiUser.companyId)
      .maybeSingle();

    if (!clientRow && !refRow) {
      return NextResponse.json(
        {
          error: "CLIENT_OR_REFERRAL_ROLE_REQUIRED",
          message: "Contact must have the Client or Referral role to use the referral portal password.",
        },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const initialRefreshToken = crypto.randomUUID();
    const initialRefreshTokenHash = hashToken(initialRefreshToken);

    const { data: existing } = await supabaseAdmin
      .from("client_profiles")
      .select("id, password_hash")
      .eq("crm_client_id", partyId)
      .maybeSingle();

    console.log("[client-app-password]", {
      partyId,
      email: emailNormalized,
      existingProfileId: existing?.id ?? null,
      existingHashPrefix: existing?.password_hash
        ? String(existing.password_hash).substring(0, 7)
        : null,
      newHashPrefix: passwordHash.substring(0, 7),
    });

    if (existing?.id) {
      const { error: updErr } = await supabaseAdmin
        .from("client_profiles")
        .update({
          password_hash: passwordHash,
          refresh_token_hash: null,
        })
        .eq("id", existing.id);
      if (updErr) {
        console.error("[client-app-password] update:", updErr);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
      }
      console.log("[client-app-password] updated password for profile:", existing.id);
    } else {
      const { error: insErr } = await supabaseAdmin.from("client_profiles").insert({
        crm_client_id: partyId,
        password_hash: passwordHash,
        refresh_token_hash: initialRefreshTokenHash,
        invited_by_agent_id: apiUser.userId,
      });
      if (insErr) {
        console.error("[client-app-password] insert:", insErr);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
      }
      console.log("[client-app-password] created new profile for party:", partyId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[client-app-password]", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
