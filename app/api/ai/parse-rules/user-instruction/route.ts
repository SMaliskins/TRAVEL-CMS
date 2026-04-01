import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PARSE_SCHEMAS, type DocumentType } from "@/lib/ai/parseSchemas";

const MAX_INSTRUCTION_LEN = 4000;

/**
 * Saves a one-shot user instruction from the parser chat as an active parse_rule
 * for the company. Injected into all future parses of this document type via loadActiveRules.
 * Any authenticated company user may call (not limited to admin — matches parse-feedback).
 */
export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request);
  if (!apiUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = consumeRateLimit({
    bucket: "ai-parse-user-instruction",
    key: apiUser.userId,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const documentType = body.documentType as DocumentType | undefined;
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";

    if (!instruction) {
      return NextResponse.json({ error: "instruction is required" }, { status: 400 });
    }
    if (instruction.length > MAX_INSTRUCTION_LEN) {
      return NextResponse.json(
        { error: `instruction too long (max ${MAX_INSTRUCTION_LEN} characters)` },
        { status: 400 }
      );
    }
    if (!documentType || !(documentType in PARSE_SCHEMAS)) {
      return NextResponse.json({ error: "Invalid documentType" }, { status: 400 });
    }

    const ruleText = `Operator instruction (always follow for this company): ${instruction}`;

    const { data: rule, error: ruleErr } = await supabaseAdmin
      .from("parse_rules")
      .insert({
        company_id: apiUser.companyId,
        document_type: documentType,
        rule_type: "correction",
        scope: "user_chat",
        priority: 5,
        rule_text: ruleText,
        source_feedback_count: 1,
        created_by: apiUser.userId,
      })
      .select("id")
      .single();

    if (ruleErr) {
      console.error("[parse-rules/user-instruction] insert error:", ruleErr);
      return NextResponse.json({ error: "Failed to save instruction" }, { status: 500 });
    }

    const { error: fbErr } = await supabaseAdmin.from("parse_feedback").insert({
      company_id: apiUser.companyId,
      user_id: apiUser.userId,
      document_type: documentType,
      field_name: "_parser_chat",
      old_value: null,
      new_value: null,
      feedback_type: "other",
      comment: instruction,
    });

    if (fbErr) {
      console.warn("[parse-rules/user-instruction] parse_feedback insert failed:", fbErr);
    }

    return NextResponse.json({ ok: true, ruleId: rule?.id });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
