import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/modules/checkModule";
import { checkAiUsageLimit } from "@/lib/ai/usageLimit";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { parseFromRequest, parseErrorToStatus } from "@/lib/ai/parseWithAI";
import type { PackageTourData } from "@/lib/ai/parseSchemas";

/**
 * Package Tour document parser - multi-operator, multi-format
 *
 * Supported input: PDF, image, or plain text
 * Supported operators: Coral Travel, Novatours, Tez Tour, Anex, Join Up, others
 *
 * Uses unified parsing pipeline (lib/ai/parseWithAI.ts).
 * Prompts are centralized in lib/ai/parsePrompts.ts.
 * Correction rules are loaded from parse_rules DB table.
 */

export async function POST(request: NextRequest) {
  const authInfo = await getApiUser(request);
  if (!authInfo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = consumeRateLimit({
    bucket: "ai-parse-package-tour",
    key: authInfo.userId,
    limit: 12,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }
  
  // Check module access (skip in development)
  if (process.env.NODE_ENV === "production") {
    const moduleError = await requireModule(authInfo.companyId, "ai_parsing");
    if (moduleError) {
      return NextResponse.json({ error: moduleError.error }, { status: moduleError.status });
    }
  }

  // Check AI usage limit
    const usage = await checkAiUsageLimit(authInfo.companyId);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: `AI usage limit reached (${usage.used}/${usage.limit} calls this month). Upgrade your plan or purchase an AI add-on.` },
        { status: 429 }
      );
  }
  
  try {
    const result = await parseFromRequest<PackageTourData>(
      request,
      "package_tour",
      authInfo.companyId,
      authInfo.userId
    );

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          error: result.error || "Could not extract tour information",
          warnings: result.warnings,
          parsed: null,
        },
        { status: parseErrorToStatus(result.errorCode) },
      );
    }

    // Backward-compatible response format
        return NextResponse.json({
      parsed: result.data,
      detectedOperator: result.data.detectedOperator || null,
    });
  } catch (err) {
    console.error("Parse package tour error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
