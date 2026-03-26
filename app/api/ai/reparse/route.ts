import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { parseFromRequest } from "@/lib/ai/parseWithAI";
import type { DocumentType } from "@/lib/ai/parseSchemas";

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

      // Rebuild the request with the feedback injected
      // We'll pass feedback as a header so parseFromRequest can use it
      const newFormData = new FormData();
      const file = formData.get("file") as File | null;
      if (file) newFormData.append("file", file);

      const newHeaders = new Headers(request.headers);
      newHeaders.set("x-parse-feedback", feedback);
      newHeaders.set("content-type", contentType);

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

      return NextResponse.json({
        parsed: result.data || null,
        detectedOperator: (result.data as Record<string, unknown>)?.detectedOperator || null,
        feedback_applied: true,
      });
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

      return NextResponse.json({
        parsed: result.data || null,
        detectedOperator: (result.data as Record<string, unknown>)?.detectedOperator || null,
        feedback_applied: true,
      });
    }
  } catch (err) {
    console.error("Reparse error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
