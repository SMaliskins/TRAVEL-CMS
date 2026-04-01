import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { parseFromRequest, type ParseResult } from "@/lib/ai/parseWithAI";
import type { DocumentType } from "@/lib/ai/parseSchemas";

function jsonFromParseResult<T>(result: ParseResult<T>) {
  const parsed = result.data ?? null;
  const base = {
    parsed,
    detectedOperator: (parsed as Record<string, unknown> | null)?.detectedOperator ?? null,
    feedback_applied: true as const,
  };
  if (!parsed) {
    return NextResponse.json(
      {
        ...base,
        error: result.error || "AI did not return valid structured data for this document.",
      },
      { status: 422 }
    );
  }
  return NextResponse.json(base);
}

/**
 * Reparse API — re-parse a document with user feedback/instructions.
 *
 * The user says what's wrong (e.g. "flights not parsed", "direction should be Latvia-Turkey")
 * and we re-parse the same document with the feedback injected as additional instructions.
 *
 * Accepts: FormData (file + feedback + documentType) or JSON (text + feedback + documentType)
 */

export async function POST(request: NextRequest) {
  const authInfo = await getApiUser(request);
  if (!authInfo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = consumeRateLimit({
    bucket: "ai-reparse",
    key: authInfo.userId,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let documentType: DocumentType = "package_tour";
    let feedback = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      documentType = (formData.get("documentType") as string as DocumentType) || "package_tour";
      feedback = (formData.get("feedback") as string) || "";

      const newFormData = new FormData();
      const file = formData.get("file") as File | null;
      if (file) newFormData.append("file", file);

      const newHeaders = new Headers();
      const auth = request.headers.get("authorization");
      if (auth) newHeaders.set("authorization", auth);
      const cookie = request.headers.get("cookie");
      if (cookie) newHeaders.set("cookie", cookie);

      const newRequest = new NextRequest(request.url, {
        method: "POST",
        headers: newHeaders,
        body: newFormData,
      });

      const result = await parseFromRequest(
        newRequest,
        documentType,
        authInfo.companyId,
        authInfo.userId,
        feedback
      );

      return jsonFromParseResult(result);
    } else {
      // JSON body
      const body = await request.json();
      documentType = body.documentType || "package_tour";
      feedback = body.feedback || "";
      const text = body.text || "";

      if (!text && !feedback) {
        return NextResponse.json({ error: "text or file required" }, { status: 400 });
      }

      const newHeaders = new Headers();
      newHeaders.set("content-type", "application/json");
      const authHeader = request.headers.get("authorization");
      if (authHeader) newHeaders.set("authorization", authHeader);
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) newHeaders.set("cookie", cookieHeader);

      const newRequest = new NextRequest(request.url, {
        method: "POST",
        headers: newHeaders,
        body: JSON.stringify({ text }),
      });

      const result = await parseFromRequest(
        newRequest,
        documentType,
        authInfo.companyId,
        authInfo.userId,
        feedback
      );

      return jsonFromParseResult(result);
    }
  } catch (err) {
    console.error("Reparse error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
