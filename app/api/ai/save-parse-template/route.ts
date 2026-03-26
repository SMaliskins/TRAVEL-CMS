import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveTemplate } from "@/lib/flights/parseTemplates";
import { saveCorrections, type CorrectionInput } from "@/lib/ai/parseCorrections";

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
    const { text, segments, booking, correctedFields, originalParsed, documentType } = body;

    if (!text || typeof text !== "string" || !segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "text and segments[] are required" }, { status: 400 });
    }

    // Save the template (with corrected data as the "gold" result)
    await saveTemplate(
      text,
      { segments: segments.slice(0, 6), booking: booking || {} },
      "manual",
      authInfo.companyId
    );

    // NEW: If user made corrections, persist them to parse_corrections table
    // so they feed back into future AI parsing as few-shot rules
    if (correctedFields && Array.isArray(correctedFields) && correctedFields.length > 0) {
      const docType = documentType || "flight";
      const airline = booking?.airline || "";

      const corrections: CorrectionInput[] = [];

      for (const fieldName of correctedFields) {
        // Try to find the original vs corrected value
        const original = getNestedValue(originalParsed, fieldName);
        const corrected = getNestedValue({ segments, booking }, fieldName);

        if (corrected !== undefined && corrected !== null && corrected !== "") {
          corrections.push({
            companyId: authInfo.companyId,
            userId: authInfo.userId,
            documentType: docType,
            contextHint: airline || undefined,
            fieldName,
            originalValue: original != null ? String(original) : undefined,
            correctedValue: String(corrected),
          });
        }
      }

      if (corrections.length > 0) {
        // Save corrections in background (non-blocking)
        saveCorrections(corrections).catch((e) =>
          console.error("Correction save error (non-fatal):", e)
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Save parse template error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Extract a value from a nested object by field name.
 * Handles dot notation (e.g. "booking.airline") and simple field names.
 */
function getNestedValue(obj: unknown, fieldName: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;

  // Direct field
  if (fieldName in record) return record[fieldName];

  // Try booking.X
  const booking = record.booking as Record<string, unknown> | undefined;
  if (booking && fieldName in booking) return booking[fieldName];

  // Try first segment
  const segments = record.segments as Record<string, unknown>[] | undefined;
  if (segments && segments.length > 0 && fieldName in segments[0]) {
    return segments[0][fieldName];
  }

  // Dot notation
  if (fieldName.includes(".")) {
    const parts = fieldName.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (!current || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  return undefined;
}
