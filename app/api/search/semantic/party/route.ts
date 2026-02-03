import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateEmbedding } from "@/lib/embeddings";
import { normalizeQueryForSemantic } from "@/lib/directory/searchNormalize";
import { createClient } from "@supabase/supabase-js";

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const client = createClient(url, key);
  const { data: { user } } = await client.auth.getUser(token);
  return user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    const companyId = profile?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: "No company" }, { status: 403 });
    }

    const body = await request.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
    const threshold = Math.min(Math.max(Number(body.threshold) || 0.3, 0), 1);

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const semanticQuery = normalizeQueryForSemantic(query);
    const embedding = await generateEmbedding(semanticQuery || query);

    const { data, error } = await supabaseAdmin.rpc("search_party_semantic", {
      query_embedding: embedding,
      p_company_id: companyId,
      match_limit: limit,
      match_threshold: threshold,
    });

    if (error) {
      console.error("search_party_semantic error:", error);
      return NextResponse.json(
        { error: "Semantic search failed", details: error.message },
        { status: 500 }
      );
    }

    const results = (data || []).map((r: { party_id: string; similarity: number }) => ({
      partyId: r.party_id,
      similarity: r.similarity,
    }));

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
