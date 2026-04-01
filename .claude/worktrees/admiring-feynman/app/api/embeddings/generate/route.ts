import { NextRequest, NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const embedding = await generateEmbedding(text);
    return NextResponse.json({ embedding });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Embedding generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
