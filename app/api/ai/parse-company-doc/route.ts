import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { parseFromRequest, parseErrorToStatus } from "@/lib/ai/parseWithAI";
import type { CompanyDocData } from "@/lib/ai/parseSchemas";

// Re-export for backward compat (components import CompanyDocData from here)
export type { CompanyDocData } from "@/lib/ai/parseSchemas";

export async function POST(request: NextRequest) {
  try {
    const authUser = await getApiUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = consumeRateLimit({
      bucket: "ai-parse-company-doc",
      key: authUser.userId,
      limit: 12,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const result = await parseFromRequest<CompanyDocData>(
      request,
      "company_doc",
      authUser.companyId,
      authUser.userId
    );

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          error: result.error || "Could not extract company information",
          warnings: result.warnings,
          company: null,
        },
        { status: parseErrorToStatus(result.errorCode) },
      );
    }

    return NextResponse.json({ company: result.data });
  } catch (err) {
    console.error("Parse company doc error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
